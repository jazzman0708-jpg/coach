import { type CoachDB, DATA_TABLES } from './db'
import type { Photo } from '../engine/types'

export const SCHEMA_VERSION = 1

interface PhotoJson {
  id: string
  date: string
  angle: Photo['angle']
  type: string
  base64: string
}

export interface BackupFile {
  app: 'coach'
  schemaVersion: number
  exportedAt: string
  tables: Record<string, unknown[]>
  photos?: PhotoJson[]
}

async function blobToBase64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

function base64ToBlob(base64: string, type: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type })
}

export async function exportAll(db: CoachDB, opts: { includePhotos: boolean; now: Date }): Promise<BackupFile> {
  const tables: Record<string, unknown[]> = {}
  for (const name of DATA_TABLES) tables[name] = await db.table(name).toArray()
  const file: BackupFile = { app: 'coach', schemaVersion: SCHEMA_VERSION, exportedAt: opts.now.toISOString(), tables }
  if (opts.includePhotos) {
    const photos = await db.photos.toArray()
    file.photos = await Promise.all(
      photos.map(async (p) => ({ id: p.id, date: p.date, angle: p.angle, type: p.blob.type, base64: await blobToBase64(p.blob) })),
    )
  }
  return file
}

export function parseBackup(text: string): BackupFile {
  const data = JSON.parse(text) as Partial<BackupFile>
  if (data.app !== 'coach' || typeof data.schemaVersion !== 'number' || !data.tables) {
    throw new Error('이 앱의 백업 파일이 아닙니다.')
  }
  if (data.schemaVersion > SCHEMA_VERSION) {
    throw new Error('더 새 버전 앱에서 만든 백업입니다. 앱을 먼저 업데이트하세요.')
  }
  return data as BackupFile
}

/** 기존 데이터를 지우고 백업으로 덮어쓴다. 사진이 없는 백업이면 기존 사진은 남긴다. */
export async function importAll(db: CoachDB, file: BackupFile) {
  const tableNames = [...DATA_TABLES, 'photos'] as const
  await db.transaction('rw', tableNames.map((n) => db.table(n)), async () => {
    for (const name of DATA_TABLES) {
      await db.table(name).clear()
      const rows = file.tables[name]
      if (rows?.length) await db.table(name).bulkPut(rows)
    }
    if (file.photos) {
      await db.photos.clear()
      await db.photos.bulkPut(
        file.photos.map((p) => ({ id: p.id, date: p.date, angle: p.angle, blob: base64ToBlob(p.base64, p.type) })),
      )
    }
  })
}

export async function resetAll(db: CoachDB) {
  await db.delete()
  await db.open()
}
