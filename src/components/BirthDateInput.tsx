import { useState } from 'react'
import type { LocalDate } from '../engine/types'
import { inputClass } from './ui'

const YEARS = Array.from({ length: 2015 - 1920 + 1 }, (_, i) => 2015 - i)
const pad = (n: number) => String(n).padStart(2, '0')
const daysIn = (y: number | undefined, m: number | undefined) => (y && m ? new Date(y, m, 0).getDate() : 31)

/**
 * 생년월일: 년·월·일을 각각 고른다. 아이폰에서 날짜 입력칸(type="date")이 비어 있으면
 * 잘 눌리지 않아서 선택 상자 세 개로 만든다. 년만 골라도 되고, 월·일까지 고르면 생년월일이 저장된다.
 */
export function BirthDateInput({
  year,
  date,
  onChange,
}: {
  year?: number
  date?: LocalDate
  onChange: (v: { birthYear?: number; birthDate?: LocalDate }) => void
}) {
  const [y, setY] = useState<number | undefined>(date ? Number(date.slice(0, 4)) : year)
  const [m, setM] = useState<number | undefined>(date ? Number(date.slice(5, 7)) : undefined)
  const [d, setD] = useState<number | undefined>(date ? Number(date.slice(8, 10)) : undefined)

  const emit = (ny?: number, nm?: number, nd?: number) => {
    const day = nd && nd <= daysIn(ny, nm) ? nd : undefined
    if (day !== nd) setD(day)
    onChange({ birthYear: ny, birthDate: ny && nm && day ? `${ny}-${pad(nm)}-${pad(day)}` : undefined })
  }

  return (
    <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2">
      <select
        aria-label="태어난 해"
        className={inputClass}
        value={y ?? ''}
        onChange={(e) => {
          const v = e.target.value ? Number(e.target.value) : undefined
          setY(v)
          emit(v, m, d)
        }}
      >
        <option value="">년</option>
        {YEARS.map((v) => (
          <option key={v} value={v}>
            {v}년
          </option>
        ))}
      </select>
      <select
        aria-label="태어난 달"
        className={inputClass}
        value={m ?? ''}
        onChange={(e) => {
          const v = e.target.value ? Number(e.target.value) : undefined
          setM(v)
          emit(y, v, d)
        }}
      >
        <option value="">월</option>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((v) => (
          <option key={v} value={v}>
            {v}월
          </option>
        ))}
      </select>
      <select
        aria-label="태어난 날"
        className={inputClass}
        value={d ?? ''}
        onChange={(e) => {
          const v = e.target.value ? Number(e.target.value) : undefined
          setD(v)
          emit(y, m, v)
        }}
      >
        <option value="">일</option>
        {Array.from({ length: daysIn(y, m) }, (_, i) => i + 1).map((v) => (
          <option key={v} value={v}>
            {v}일
          </option>
        ))}
      </select>
    </div>
  )
}
