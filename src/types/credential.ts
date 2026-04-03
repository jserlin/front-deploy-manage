export interface ServerCredential {
  id: number
  name: string
  host: string
  port: number
  username: string
  authType: 'password' | 'key'
  password?: string
  privateKey?: string
  passphrase?: string
  environment: 'dev' | 'test' | 'prod'
  description?: string
  createdAt: string
  updatedAt: string
}

export interface SvnCredential {
  id: number
  name: string
  svnUrl: string
  username: string
  password: string
  environment: 'dev' | 'test' | 'prod'
  description?: string
  createdAt: string
  updatedAt: string
}
