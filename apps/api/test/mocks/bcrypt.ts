export async function hash(): Promise<string> {
  return 'test-hash'
}

export async function compare(): Promise<boolean> {
  return true
}

export const genSalt = async (): Promise<string> => 'test-salt'
