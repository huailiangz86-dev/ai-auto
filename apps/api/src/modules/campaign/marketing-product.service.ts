import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, In, Repository } from 'typeorm'
import { Campaign } from './entities/campaign.entity'
import { Coupon } from './entities/coupon.entity'
import { CouponProductMapping } from './entities/coupon-product-mapping.entity'
import { MarketingProduct, MarketingProductSku } from './entities/marketing-product.entity'
import {
  CreateExternalCouponProductMappingDto,
  CreateMarketingProductDto,
  ListMarketingProductsDto,
  ReplaceCouponProductMappingsDto,
  UpdateMarketingProductDto,
} from './dto/marketing-product.dto'

@Injectable()
export class MarketingProductService {
  constructor(
    @InjectRepository(MarketingProduct) private readonly productRepo: Repository<MarketingProduct>,
    @InjectRepository(MarketingProductSku)
    private readonly skuRepo: Repository<MarketingProductSku>,
    @InjectRepository(CouponProductMapping)
    private readonly mappingRepo: Repository<CouponProductMapping>,
    @InjectRepository(Coupon) private readonly couponRepo: Repository<Coupon>,
    @InjectRepository(Campaign) private readonly campaignRepo: Repository<Campaign>,
    private readonly dataSource: DataSource,
  ) {}

  async listProducts(merchantId: string, query: ListMarketingProductsDto) {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const where: any = { merchantId }
    if (query.status) where.status = query.status
    const [products, total] = await this.productRepo.findAndCount({
      where,
      relations: ['skus'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })
    return {
      items: products.map((product) => this.serializeProduct(product)),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    }
  }

  async createProduct(merchantId: string, dto: CreateMarketingProductDto) {
    this.assertUniqueSkuCodes(dto.skus)
    const product = await this.dataSource.transaction(async (manager) => {
      const products = manager.getRepository(MarketingProduct)
      if (
        dto.productSource === 'external' &&
        (await products.exist({ where: { merchantId, externalProductId: dto.externalProductId } }))
      ) {
        throw new BadRequestException({ code: 4001, message: '该外部商品 ID 已存在' })
      }
      const created = await products.save(
        products.create({
          merchantId,
          productName: dto.productName,
          category: dto.category,
          description: dto.description ?? null,
          productSource: dto.productSource ?? 'managed',
          externalProductId: dto.productSource === 'external' ? dto.externalProductId : null,
          status: dto.status ?? 'draft',
        }),
      )
      const skus = dto.skus.map((sku) =>
        manager.getRepository(MarketingProductSku).create({
          productId: created.id,
          skuName: sku.skuName,
          skuCode: sku.skuCode,
          attributes: sku.attributes ?? {},
          price: sku.price,
          marketPrice: sku.marketPrice ?? null,
          stock: sku.stock ?? null,
          status: sku.status ?? 'on_sale',
        }),
      )
      await manager.getRepository(MarketingProductSku).save(skus)
      return products.findOneOrFail({ where: { id: created.id }, relations: ['skus'] })
    })
    return this.serializeProduct(product)
  }

  async updateProduct(merchantId: string, productId: string, dto: UpdateMarketingProductDto) {
    this.assertUniqueSkuCodes(dto.skus)
    const product = await this.dataSource.transaction(async (manager) => {
      const products = manager.getRepository(MarketingProduct)
      const skus = manager.getRepository(MarketingProductSku)
      const mappings = manager.getRepository(CouponProductMapping)
      const existing = await products.findOne({
        where: { id: productId, merchantId },
        relations: ['skus'],
      })
      if (!existing) throw new NotFoundException({ code: 4004, message: '营销商品不存在' })
      if (
        dto.productSource === 'external' &&
        dto.externalProductId !== existing.externalProductId &&
        (await products.exist({ where: { merchantId, externalProductId: dto.externalProductId } }))
      ) {
        throw new BadRequestException({ code: 4001, message: '该外部商品 ID 已存在' })
      }
      Object.assign(existing, {
        productName: dto.productName,
        category: dto.category,
        description: dto.description ?? null,
        productSource: dto.productSource ?? 'managed',
        externalProductId: dto.productSource === 'external' ? dto.externalProductId : null,
        status: dto.status ?? existing.status,
      })
      await products.save(existing)
      const currentById = new Map(existing.skus.map((sku) => [sku.id, sku]))
      const retainedIds = new Set(dto.skus.flatMap((sku) => (sku.skuId ? [sku.skuId] : [])))
      const removedIds = existing.skus
        .filter((sku) => !retainedIds.has(sku.id))
        .map((sku) => sku.id)
      if (removedIds.length && (await mappings.exist({ where: { skuId: In(removedIds) } }))) {
        throw new BadRequestException({
          code: 4002,
          message: '已有优惠券关联的 SKU 不可删除，请先解除关联',
        })
      }
      if (removedIds.length) await skus.delete(removedIds)
      for (const dtoSku of dto.skus) {
        if (dtoSku.skuId && !currentById.has(dtoSku.skuId))
          throw new BadRequestException({ code: 4003, message: 'SKU 不属于该营销商品' })
        const sku = dtoSku.skuId ? currentById.get(dtoSku.skuId)! : skus.create({ productId })
        Object.assign(sku, {
          skuName: dtoSku.skuName,
          skuCode: dtoSku.skuCode,
          attributes: dtoSku.attributes ?? {},
          price: dtoSku.price,
          marketPrice: dtoSku.marketPrice ?? null,
          stock: dtoSku.stock ?? null,
          status: dtoSku.status ?? 'on_sale',
        })
        await skus.save(sku)
      }
      return products.findOneOrFail({ where: { id: productId }, relations: ['skus'] })
    })
    return this.serializeProduct(product)
  }

  async changeProductStatus(
    merchantId: string,
    productId: string,
    status: 'on_sale' | 'off_shelf',
  ) {
    const product = await this.productRepo.findOne({ where: { id: productId, merchantId } })
    if (!product) throw new NotFoundException({ code: 4004, message: '营销商品不存在' })
    product.status = status
    await this.productRepo.save(product)
    return this.serializeProduct(product)
  }

  async listCouponMappings(merchantId: string, couponId: string) {
    await this.getCouponForMerchant(merchantId, couponId)
    const mappings = await this.mappingRepo.find({
      where: { merchantId, couponId },
      order: { createdAt: 'ASC' },
    })
    return {
      items: mappings.map((mapping) => ({
        mappingId: mapping.id,
        type: mapping.type,
        productId: mapping.productId,
        skuId: mapping.skuId,
        externalProductId: mapping.externalProductId,
        externalProductName: mapping.externalProductName,
        externalCategory: mapping.externalCategory,
        callbackUrl: mapping.callbackUrl,
        status: mapping.status,
      })),
    }
  }

  async replaceCatalogueMappings(
    merchantId: string,
    couponId: string,
    dto: ReplaceCouponProductMappingsDto,
  ) {
    await this.getCouponForMerchant(merchantId, couponId, true)
    const productIds = [...new Set(dto.productSelections.map((selection) => selection.productId))]
    if (productIds.length !== dto.productSelections.length)
      throw new BadRequestException({ code: 4001, message: '同一营销商品只能选择一次' })
    const products = await this.productRepo.find({
      where: { id: In(productIds), merchantId, status: 'on_sale' },
      relations: ['skus'],
    })
    if (products.length !== productIds.length)
      throw new BadRequestException({ code: 4002, message: '营销商品不存在或未上架' })
    const records: Partial<CouponProductMapping>[] = []
    for (const selection of dto.productSelections) {
      const product = products.find((item) => item.id === selection.productId)!
      const skuIds = [...new Set(selection.skuIds ?? [])]
      if (!skuIds.length)
        records.push({
          merchantId,
          couponId,
          type: 'catalogue',
          productId: product.id,
          skuId: null,
          status: true,
        })
      else {
        const validSkus = product.skus.filter(
          (sku) => skuIds.includes(sku.id) && sku.status === 'on_sale',
        )
        if (validSkus.length !== skuIds.length)
          throw new BadRequestException({ code: 4003, message: 'SKU 不存在或未上架' })
        records.push(
          ...validSkus.map((sku) => ({
            merchantId,
            couponId,
            type: 'catalogue' as const,
            productId: product.id,
            skuId: sku.id,
            status: true,
          })),
        )
      }
    }
    await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(CouponProductMapping)
        .delete({ merchantId, couponId, type: 'catalogue' })
      await manager.getRepository(CouponProductMapping).save(records)
    })
    return this.listCouponMappings(merchantId, couponId)
  }

  async addExternalMapping(
    merchantId: string,
    couponId: string,
    dto: CreateExternalCouponProductMappingDto,
  ) {
    await this.getCouponForMerchant(merchantId, couponId, true)
    let mapping = await this.mappingRepo.findOne({
      where: {
        merchantId,
        couponId,
        type: 'legacy_external',
        externalProductId: dto.externalProductId,
      },
    })
    if (!mapping)
      mapping = this.mappingRepo.create({
        merchantId,
        couponId,
        type: 'legacy_external',
        externalProductId: dto.externalProductId,
        status: true,
      })
    Object.assign(mapping, {
      externalProductName: dto.externalProductName ?? null,
      externalCategory: dto.externalCategory ?? null,
      callbackUrl: dto.callbackUrl ?? null,
    })
    await this.mappingRepo.save(mapping)
    return { mappingId: mapping.id }
  }

  async removeExternalMapping(merchantId: string, couponId: string, mappingId: string) {
    await this.getCouponForMerchant(merchantId, couponId, true)
    const mapping = await this.mappingRepo.findOne({
      where: { id: mappingId, merchantId, couponId, type: 'legacy_external' },
    })
    if (!mapping) throw new NotFoundException({ code: 4005, message: '外部商品映射不存在' })
    await this.mappingRepo.softDelete(mapping.id)
  }

  private async getCouponForMerchant(merchantId: string, couponId: string, requireDraft = false) {
    const coupon = await this.couponRepo.findOne({ where: { id: couponId, merchantId } })
    if (!coupon) throw new NotFoundException({ code: 4011, message: '优惠券不存在' })
    if (requireDraft) {
      const campaign = await this.campaignRepo.findOne({
        where: { id: coupon.campaignId, merchantId },
      })
      if (!campaign || campaign.campaignStatus !== 'draft')
        throw new BadRequestException({ code: 4004, message: '只有草稿活动可以修改商品映射' })
    }
    return coupon
  }

  private assertUniqueSkuCodes(skus: CreateMarketingProductDto['skus']) {
    if (new Set(skus.map((sku) => sku.skuCode)).size !== skus.length)
      throw new BadRequestException({ code: 4005, message: '同一营销商品内 SKU 编码不能重复' })
  }

  private serializeProduct(product: MarketingProduct) {
    return {
      productId: product.id,
      productName: product.productName,
      category: product.category,
      description: product.description,
      productSource: product.productSource,
      externalProductId: product.externalProductId,
      status: product.status,
      skus: (product.skus ?? []).map((sku) => ({
        skuId: sku.id,
        skuName: sku.skuName,
        skuCode: sku.skuCode,
        attributes: sku.attributes,
        price: Number(sku.price),
        marketPrice: sku.marketPrice == null ? null : Number(sku.marketPrice),
        stock: sku.stock,
        status: sku.status,
      })),
    }
  }
}
