import { defineStore } from 'pinia'
import { claimCoupon, getMyCoupons, getNearbyCoupons } from '../api/customer'
import { usePromotionStore } from './promotion'
import type { CouponStatus, CustomerCoupon, NearbyStore, Pagination } from '../types/customer'

const INITIAL_PAGINATION: Pagination = { page: 1, pageSize: 20, total: 0, totalPages: 0 }

export const useCouponStore = defineStore('customer-coupon', {
  state: () => ({
    nearbyStores: [] as NearbyStore[],
    coupons: [] as CustomerCoupon[],
    nearbyPagination: { ...INITIAL_PAGINATION },
    couponPagination: { ...INITIAL_PAGINATION },
    loadingNearby: false,
    loadingCoupons: false,
  }),
  actions: {
    async fetchNearby(
      params: {
        latitude?: number
        longitude?: number
        city?: string
        category?: string
        page?: number
      } = {},
    ) {
      this.loadingNearby = true
      try {
        const page = params.page ?? 1
        const result = await getNearbyCoupons({ ...params, page, pageSize: 20 })
        this.nearbyStores = page === 1 ? result.items : [...this.nearbyStores, ...result.items]
        this.nearbyPagination = result.pagination
      } finally {
        this.loadingNearby = false
      }
    },
    async fetchCoupons(status: CouponStatus = 'active') {
      this.loadingCoupons = true
      try {
        const result = await getMyCoupons({ status, page: 1, pageSize: 50 })
        this.coupons = result.items
        this.couponPagination = result.pagination
      } finally {
        this.loadingCoupons = false
      }
    },
    async claim(couponId: string, trackingConsent: boolean, attributionId?: string) {
      const promotionStore = usePromotionStore()
      if (trackingConsent) await promotionStore.ensureReferral(couponId)
      const claimed = await claimCoupon(
        couponId,
        trackingConsent ? (attributionId ?? promotionStore.attributionId) || undefined : undefined,
        trackingConsent,
      )
      this.nearbyStores = this.nearbyStores.map((store: NearbyStore) => ({
        ...store,
        coupons: store.coupons.map((coupon) => (coupon.couponId === couponId ? coupon : coupon)),
      }))
      this.coupons = [claimed, ...this.coupons]
      return claimed
    },
  },
})
