// ============================================================
// AI Bridge Service - HTTP client to AI Agent service
// ============================================================

import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AIBridgeService {
  private readonly logger = new Logger(AIBridgeService.name);

  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {}

  private getHeaders() {
    const apiKey = this.configService.get('ai.apiKey');
    return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
  }

  async configureCampaign(params: {
    description: string;
    merchant_id: string;
    store_id?: string;
    language?: string;
  }) {
    try {
      const { data } = await firstValueFrom(
        this.httpService.post('/api/v1/campaign/configure', params, {
          headers: this.getHeaders(),
        }),
      );
      return data;
    } catch (error) {
      this.logger.error('Failed to configure campaign', error);
      throw error;
    }
  }

  async optimizeCampaign(params: { campaign_id: string; current_metrics: any }) {
    try {
      const { data } = await firstValueFrom(
        this.httpService.post('/api/v1/campaign/optimize', params, {
          headers: this.getHeaders(),
        }),
      );
      return data;
    } catch (error) {
      this.logger.error('Failed to optimize campaign', error);
      throw error;
    }
  }

  async generateCopywriting(params: {
    coupon_id: string;
    campaign_id: string;
    agent_id: string;
    platform: string;
    tone?: string;
    count?: number;
  }) {
    try {
      const { data } = await firstValueFrom(
        this.httpService.post('/api/v1/content/copywriting', params, {
          headers: this.getHeaders(),
        }),
      );
      return data;
    } catch (error) {
      this.logger.error('Failed to generate copywriting', error);
      throw error;
    }
  }

  async generateVideo(params: {
    coupon_id: string;
    campaign_id: string;
    agent_id: string;
    platform: string;
    duration_seconds?: number;
  }) {
    try {
      const { data } = await firstValueFrom(
        this.httpService.post('/api/v1/content/video', params, {
          headers: this.getHeaders(),
        }),
      );
      return data;
    } catch (error) {
      this.logger.error('Failed to generate video', error);
      throw error;
    }
  }

  async generatePoster(params: {
    coupon_id: string;
    agent_id: string;
    platform: string;
    style?: string;
    color_scheme?: string;
  }) {
    try {
      const { data } = await firstValueFrom(
        this.httpService.post('/api/v1/content/poster', params, {
          headers: this.getHeaders(),
        }),
      );
      return data;
    } catch (error) {
      this.logger.error('Failed to generate poster', error);
      throw error;
    }
  }

  async moderateContent(params: { content_type: string; content?: string; media_url?: string }) {
    try {
      const { data } = await firstValueFrom(
        this.httpService.post('/api/v1/moderation/check', params, {
          headers: this.getHeaders(),
        }),
      );
      return data;
    } catch (error) {
      this.logger.error('Failed to moderate content', error);
      throw error;
    }
  }
}
