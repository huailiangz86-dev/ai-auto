import { Transform, Type } from 'class-transformer'
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsNotEmptyObject,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'
import {
  RISK_RULE_ACTIONS,
  RISK_RULE_TRIGGER_TYPES,
  RiskRuleAction,
  RiskRuleSeverity,
  RiskRuleTriggerType,
} from '../entities/risk-rule.entity'

export class RiskRuleConditionDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(525600)
  windowMinutes?: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  threshold?: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  multiplier?: number

  @IsOptional()
  @IsString()
  @MaxLength(80)
  metric?: string

  @IsOptional()
  @IsString()
  @MaxLength(80)
  scope?: string
}

export class CreateRiskRuleDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  name!: string

  @IsNotEmpty()
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{2,79}$/)
  ruleKey!: string

  @IsIn(RISK_RULE_TRIGGER_TYPES)
  triggerType!: RiskRuleTriggerType

  @IsIn(['critical', 'warning', 'notice'])
  severity!: RiskRuleSeverity

  @IsObject()
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => RiskRuleConditionDto)
  conditionConfig!: RiskRuleConditionDto

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(RISK_RULE_ACTIONS, { each: true })
  actions!: RiskRuleAction[]

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string

  @IsOptional()
  @IsBoolean()
  enabled?: boolean
}

export class UpdateRiskRuleDto {
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  name?: string

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{2,79}$/)
  ruleKey?: string

  @IsOptional()
  @IsIn(RISK_RULE_TRIGGER_TYPES)
  triggerType?: RiskRuleTriggerType

  @IsOptional()
  @IsIn(['critical', 'warning', 'notice'])
  severity?: RiskRuleSeverity

  @IsOptional()
  @IsObject()
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => RiskRuleConditionDto)
  conditionConfig?: RiskRuleConditionDto

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(RISK_RULE_ACTIONS, { each: true })
  actions?: RiskRuleAction[]

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null

  @IsOptional()
  @IsBoolean()
  enabled?: boolean
}

export class ListRiskRulesDto {
  @Transform(({ value }) =>
    value === true || value === 'true'
      ? true
      : value === false || value === 'false'
        ? false
        : value,
  )
  @IsOptional()
  @IsBoolean()
  enabled?: boolean

  @IsOptional()
  @IsIn(RISK_RULE_TRIGGER_TYPES)
  triggerType?: RiskRuleTriggerType
}

export class ToggleRiskRuleDto {
  @IsBoolean()
  enabled!: boolean
}
