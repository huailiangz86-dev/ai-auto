// ============================================================
// Current User Decorator - Extract user from JWT
// ============================================================

import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { UserRole } from '@ai-auto/shared'

export interface CurrentUserPayload {
  id: string
  role: UserRole
  merchantId?: string
  agentId?: string
  phone?: string
  username?: string
}

/**
 * Decorator to extract the current authenticated user from the request
 * Usage: @CurrentUser() user: CurrentUserPayload
 */
export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    const user = request.user as CurrentUserPayload

    if (!user) {
      return null
    }

    return data ? user[data] : user
  },
)
