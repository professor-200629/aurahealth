// Health readings typed into Talk to Aura ("temperature 99.9", "BP 190/120", "sugar 60", "oxygen 91") are answered
// on the phone at once, with fixed thresholds from public health bodies (no model, works offline):
// - temperature: NHS, "High temperature (fever) in adults": 38°C (100.4°F) or above is a high temperature
//   (https://www.nhs.uk/symptoms/fever-in-adults/); emergency signs from NHS meningitis and fever advice; babies: NHS,
//   "High temperature (fever) in children": under 3 months with 38°C or more, 3 to 6 months with 39°C or more
//   (https://www.nhs.uk/symptoms/fever-in-children/)
// - blood pressure: American Heart Association, "When to call 911 about high blood pressure": above 180/120 with chest
//   pain, shortness of breath, back pain, numbness, weakness, vision change or trouble speaking → emergency; without
//   symptoms, wait a minute and measure again, then contact the doctor (https://www.heart.org/)
// - blood sugar: American Diabetes Association levels (below 70 mg/dL low, below 54 serious; confused or needing help
//   = severe) with the IFRC 2020 first aid (sugar if awake and able to swallow, again after 15 minutes)
// - oxygen: NHS home pulse-oximeter leaflets (written for COVID-19): 92% or below after a re-check → 999 / A&E;
//   93-94% → contact a doctor soon
// It never says what illness someone has. Amounts of medicine are never given.
import type { AuraAnswer } from './chatlocal'

const num = (s: string) => Number(s.replace(',', '.'))
const f2c = (f: number) => Math.round(((f - 32) * 5) / 9 * 10) / 10
const c2f = (c: number) => Math.round((c * 9) / 5 * 10 + 320) / 10

function answer(text: string, emergency = false, guides: string[] = []): AuraAnswer {
  return { text, guides, action: emergency ? 'call_emergency' : 'none', source: 'phone' }
}

function temperature(s: string, n: string): AuraAnswer | null {
  if (!/\b(temp(erature)?|fever|thermometer|bukhar|jwaram)\b/.test(s)) return null
  const v = num(n)
  let c: number
  let f: number
  if (/°?\s*c\b|celsius/.test(s) || (v >= 34 && v <= 43)) {
    c = v
    f = c2f(v)
  } else if (v >= 93 && v <= 110) {
    f = v
    c = f2c(v)
  } else return null
  const both = `${f.toFixed(1)}°F (${c.toFixed(1)}°C)`
  const red =
    'Call 112 now if they also have confusion or are very sleepy, a stiff neck, a rash that does not fade when you press a glass on it, trouble breathing, chest pain or a fit.'
  if (c >= 40)
    return answer(
      `${both} is a very high temperature. Call 112 or get urgent medical help now, especially if they are older, confused or very unwell. Meanwhile help them rest somewhere cool and give sips of water if they are awake. ${red}`,
      true,
    )
  if (c >= 38)
    return answer(
      `${both} is a high temperature (fever): 38°C / 100.4°F or more, as the NHS defines it. Help them rest, drink plenty of water and keep cool (light clothes, no heavy blankets). A fever medicine can help if their doctor agrees: follow the label or the prescription. See a doctor today if they are older or have a long-term illness, if it is getting worse, or if it lasts more than 3 days. A baby needs a doctor right away: under 3 months with 38°C / 100.4°F or more, or 3 to 6 months with 39°C / 102.2°F or more. ${red}`,
    )
  if (c >= 37.5)
    return answer(
      `${both} is a little above normal, but not a high temperature yet: the NHS counts a fever from 38°C / 100.4°F. Let them rest and drink water, and measure again in a few hours. If it rises to 100.4°F or more, or they feel worse, ask Aura again or see a doctor. ${red}`,
    )
  if (c >= 35.5) return answer(`${both} is a normal body temperature. If they still feel unwell, tell me what else you notice.`)
  return answer(
    `${both} is low. Measure again with the thermometer under the tongue or in the armpit for the full time. If it is really this low, warm them up with blankets and a warm (not hot) drink if they are awake, and call 112 if they are confused, very sleepy or shivering hard.`,
    c < 35,
  )
}

function pressure(sys: number, dia: number): AuraAnswer | null {
  if (sys < 60 || sys > 280 || dia < 30 || dia > 180 || dia >= sys) return null
  const r = `${sys}/${dia}`
  if (sys > 180 || dia > 120)
    return answer(
      `${r} is very high. If they have chest pain, shortness of breath, back pain, numbness or weakness, a change in vision or trouble speaking, call 112 now. If they have none of these, let them sit quietly, wait a minute and measure again; if it is still above 180/120, call their doctor straight away (American Heart Association advice). Do not give extra blood pressure tablets unless their doctor has said so.`,
      true,
    )
  if (sys < 90 || dia < 60)
    return answer(
      `${r} is low. If they feel dizzy or faint, help them lie down with their legs raised and give water if they are awake. Call 112 if they faint and do not wake quickly, or have chest pain, confusion or trouble breathing. Tell their doctor about it, especially if they take blood pressure medicine.`,
    )
  if (sys >= 140 || dia >= 90)
    return answer(
      `${r} is high (stage 2 high blood pressure by the American Heart Association's categories), but not an emergency on its own. Let them rest for 5 minutes and measure again, seated with the arm supported. Tell their doctor if it stays this high. Call 112 if they get chest pain, trouble breathing, weakness on one side, a drooping face or trouble speaking.`,
    )
  if (sys >= 130 || dia >= 80)
    return answer(`${r} is a little high (stage 1 by the American Heart Association's categories). Measure again after resting; if it stays this high on different days, tell their doctor.`)
  if (sys >= 120) return answer(`${r} is slightly above the ideal (below 120/80). Keep an eye on it and mention it at their next doctor visit.`)
  return answer(`${r} is in the normal range (below 120/80).`)
}

function sugar(s: string, n: string): AuraAnswer | null {
  if (!/\b(sugar|glucose|rbs|fbs|ppbs|glucometer)\b/.test(s) || /hba-one-c|a1c/.test(s)) return null // HbA1c is a 3-month average, not today's level
  let mg = num(n)
  if (/mmol/.test(s) || (mg > 0 && mg < 30)) mg = Math.round(mg * 18)
  if (mg < 20 || mg > 700) return null
  const r = `${mg} mg/dL`
  if (mg < 70 && /\b(confus\w*|drows\w*|unconscious|not waking|won'?t wake|(can'?t|cannot) swallow|fits?|seizure)\b/.test(s))
    return answer(
      `Call 112 now. ${r} is low blood sugar, and what you describe is a serious sign. If they are awake and can swallow, give something sugary while you wait (their glucose tablets, fruit juice or a sugary non-diet drink). If they cannot swallow, give nothing by mouth.`,
      true,
      ['low_sugar'],
    )
  if (mg < 70)
    return answer(
      `${r} is low blood sugar${mg < 54 ? ', and below 54 is serious' : ''}. If they are awake and can swallow, give something sugary now (their glucose tablets, fruit juice, a sugary non-diet drink or sweets), let them sit, and check again in 15 minutes; give sugar again if it is still low. Call 112 if they are confused, very drowsy, cannot swallow or have a fit.`,
      mg < 54,
      ['low_sugar'],
    )
  if (mg > 300)
    return answer(
      `${r} is very high. Give water to drink and follow their doctor's plan for high readings; call their doctor today. Call 112 if they are vomiting and cannot keep fluids down, are very drowsy or confused, or breathe fast and deep.`,
    )
  if (mg > 180) return answer(`${r} is high. Give water, follow their usual plan and check again later. Tell their doctor if it stays high.`)
  return answer(`${r} is not low. If they still feel unwell, tell me what else you notice.`)
}

function oxygen(s: string, n: string): AuraAnswer | null {
  if (!/\b(oxygen|spo2|sp o2|saturation|oximeter|o2)\b/.test(s)) return null
  const v = num(n)
  if (v < 50 || v > 100) return null
  if (v <= 92)
    return answer(
      `An oxygen level of ${v}% is low. Check again now on a warm finger with nail polish removed. If it is still 92% or below, call 112 or go to the emergency department now (NHS home-monitoring advice), and help them sit upright.`,
      true,
    )
  if (v <= 94) return answer(`${v}% is a little low. Let them rest sitting up and check again within an hour; if it stays at 93-94%, contact a doctor soon. Call 112 if it drops to 92% or below, or they get breathless, confused or have chest pain.`)
  return answer(`${v}% is a normal oxygen level (95% or more). If they still feel breathless or unwell, tell me more.`)
}

/** A health reading in the person's message, answered with fixed thresholds; null if there is none. */
export function readingAnswer(text: string): AuraAnswer | null {
  // Digits that are part of a word ("spo2", "o2", "hba1c") are not the reading.
  const s = text.toLowerCase().replace(/\bsp\s?o2\b|\bo2\b/g, 'oxygen').replace(/\bhba1c\b/g, 'hba-one-c')
  const bp = s.match(/\b(\d{2,3})\s*(\/|over)\s*(\d{2,3})\b/)
  if (bp && (/\b(bp|b\.p\.|pressure)\b/.test(s) || Number(bp[1]) >= 80)) return pressure(Number(bp[1]), Number(bp[3]))
  const n = s.match(/(\d{1,3}(?:[.,]\d)?)/)
  if (!n) return null
  return temperature(s, n[1]) ?? oxygen(s, n[1]) ?? sugar(s, n[1])
}
