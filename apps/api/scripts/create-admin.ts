import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createInterface } from 'node:readline'
import * as bcrypt from 'bcrypt'
import { Client } from 'pg'

// Use the same bcrypt cost as AuthService. This command is intentionally
// local-only: it never prints passwords or hashes and refuses production.
const BCRYPT_ROUNDS = 12

function loadEnvFile(path: string) {
  try {
    const contents = readFileSync(path, 'utf8')
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/)
      if (!match || match[1] in process.env) continue
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2')
    }
  } catch {
    // Environment variables supplied by the shell are sufficient.
  }
}

function argument(name: string) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function ask(question: string) {
  const readline = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise<string>((resolveAnswer) => {
    readline.question(question, (answer) => {
      readline.close()
      resolveAnswer(answer.trim())
    })
  })
}

function askSecret(question: string) {
  if (!process.stdin.isTTY) return ask(question)

  process.stdout.write(question)
  process.stdin.setRawMode(true)
  process.stdin.resume()
  process.stdin.setEncoding('utf8')
  return new Promise<string>((resolveAnswer, reject) => {
    let value = ''
    const onData = (chunk: string) => {
      for (const character of chunk) {
        if (character === '\u0003') {
          cleanup()
          reject(new Error('已取消'))
          return
        }
        if (character === '\r' || character === '\n') {
          cleanup()
          process.stdout.write('\n')
          resolveAnswer(value)
          return
        }
        if (character === '\u007f') {
          value = value.slice(0, -1)
          continue
        }
        value += character
      }
    }
    const cleanup = () => {
      process.stdin.setRawMode(false)
      process.stdin.pause()
      process.stdin.off('data', onData)
    }
    process.stdin.on('data', onData)
  })
}

async function main() {
  loadEnvFile(resolve(process.cwd(), '.env.local'))
  loadEnvFile(resolve(process.cwd(), '.env'))

  if (
    (process.env.NODE_ENV ?? 'development') === 'production' &&
    process.env.ALLOW_ADMIN_BOOTSTRAP !== 'true'
  ) {
    throw new Error(
      '生产环境禁止执行管理员初始化；如确需执行，请显式设置 ALLOW_ADMIN_BOOTSTRAP=true',
    )
  }

  const username =
    argument('username') ||
    process.env.ADMIN_USERNAME ||
    (await ask('管理员用户名 [admin]: ')) ||
    'admin'
  const realName = argument('real-name') || process.env.ADMIN_REAL_NAME || '系统管理员'
  const role = argument('role') || process.env.ADMIN_ROLE || 'super_admin'
  const password = process.env.ADMIN_PASSWORD || (await askSecret('管理员密码（输入时不显示）: '))

  if (!/^[a-zA-Z0-9_-]{2,50}$/.test(username))
    throw new Error('用户名只能包含字母、数字、下划线或短横线，长度 2-50')
  if (password.length < 8) throw new Error('管理员密码至少需要 8 位')
  if (
    ![
      'super_admin',
      'merchant_reviewer',
      'agent_reviewer',
      'content_moderator',
      'finance',
      'operator',
    ].includes(role)
  )
    throw new Error(`不支持的管理员角色：${role}`)

  const client = new Client({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME || 'ai_auto',
    password: process.env.DB_PASSWORD || 'ai_auto_dev',
    database: process.env.DB_NAME || 'ai_auto_dev',
  })

  await client.connect()
  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
    await client.query('BEGIN')
    const existing = await client.query('SELECT id FROM admins WHERE username = $1 FOR UPDATE', [
      username,
    ])
    if (existing.rowCount) {
      await client.query(
        'UPDATE admins SET "passwordHash" = $1, "realName" = $2, "role" = $3, status = true, "updatedAt" = now() WHERE username = $4',
        [passwordHash, realName, role, username],
      )
      console.log(`管理员 ${username} 已重置并启用`)
    } else {
      await client.query(
        'INSERT INTO admins ("username", "passwordHash", "realName", "role", status) VALUES ($1, $2, $3, $4, true)',
        [username, passwordHash, realName, role],
      )
      console.log(`管理员 ${username} 已创建并启用`)
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
