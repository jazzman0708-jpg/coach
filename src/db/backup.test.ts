import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { CoachDB } from './db'
import { exportAll, importAll, parseBackup, resetAll } from './backup'

describe('백업·복원', () => {
  it('첫 실행에 기본 설정과 초기 프로그램이 생긴다', async () => {
    const db = new CoachDB('t-populate')
    expect((await db.settings.get('singleton'))?.disclaimerAcceptedAt).toBeUndefined()
    expect((await db.programVersions.get(1))?.slots).toHaveLength(5)
    await db.delete()
  })

  it('내보내기 → 초기화 → 가져오기를 거쳐도 기록과 사진이 그대로다', async () => {
    const db = new CoachDB('t-roundtrip')
    await db.bodyLogs.add({ id: 'b1', date: '2026-10-22', weightKg: 70, at: '2026-10-22T08:00:00+09:00' })
    await db.photos.add({ id: 'p1', date: '2026-10-22', angle: 'front', blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }) })

    const file = await exportAll(db, { includePhotos: true, now: new Date('2026-10-22T12:00:00Z') })
    const text = JSON.stringify(file)

    await resetAll(db)
    expect(await db.bodyLogs.count()).toBe(0)

    await importAll(db, parseBackup(text))
    expect((await db.bodyLogs.get('b1'))?.weightKg).toBe(70)
    const photo = await db.photos.get('p1')
    expect(photo?.blob.type).toBe('image/jpeg')
    expect(new Uint8Array(await photo!.blob.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]))
    await db.delete()
  })

  it('다른 앱 파일이나 더 새 스키마는 거부한다', () => {
    expect(() => parseBackup('{"app":"other"}')).toThrow()
    expect(() => parseBackup('{"app":"coach","schemaVersion":99,"tables":{}}')).toThrow()
  })
})
