import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { SharingAgent } from '../agent/entities/sharing-agent.entity'
import {
  CustomerGamificationController,
  GamificationAdminController,
} from './gamification.controller'
import { GamificationService } from './gamification.service'
import {
  CustomerChallengeProgress,
  CustomerPointAccount,
  CustomerPointLedger,
  MysteryBoxOpening,
  RewardProduct,
  SharingChallenge,
} from './entities/gamification.entity'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CustomerPointAccount,
      CustomerPointLedger,
      RewardProduct,
      SharingChallenge,
      CustomerChallengeProgress,
      MysteryBoxOpening,
      SharingAgent,
    ]),
  ],
  controllers: [CustomerGamificationController, GamificationAdminController],
  providers: [GamificationService],
  exports: [GamificationService],
})
export class GamificationModule {}
