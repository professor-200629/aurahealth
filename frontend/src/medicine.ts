// The medicine questions that matter most get a fixed, immediate answer, also with no AI and no internet: a missed dose, how much to take,
// stopping a medicine, mixing medicines and medicines in pregnancy. These never give an amount or say to start or stop anything.
// The wording is the developer's own, from general MedlinePlus-level advice. No clinician or pharmacist has reviewed it.
import type { AuraAnswer } from './chatlocal'

const MED = String.raw`(tablets?|tabs?|pills?|capsules?|medicines?|medications?|drugs?|doses?|insulin|syrup|paracetamol|crocin|dolo|calpol|ibuprofen|aspirin|metformin|antibiotics?|painkillers?|bp tablet)`
const ask = 'Their doctor or pharmacist can answer this for the exact medicine.'

function answer(text: string, nextStep: string, urgentIf: string[] = []): AuraAnswer {
  return { text, nextStep, urgentIf, guides: [], action: 'none', source: 'phone', kind: 'medicine' }
}

export function medicineAnswer(question: string): AuraAnswer | null {
  const s = question.toLowerCase()
  const has = (pattern: string) => new RegExp(pattern, 'i').test(s)
  if (!has(MED)) return null
  if (has(String.raw`\bpregnan\w*|\bbreastfeed\w*`))
    return answer(
      'Please ask a doctor or pharmacist before taking any medicine while pregnant or breastfeeding, even one you usually take. Some are fine and some are not, and I cannot tell which from here.',
      'Call or visit their doctor or pharmacist today, and tell them how far along the pregnancy is. Do not stop a prescribed medicine by yourself either.',
      ['heavy bleeding', 'severe belly pain', 'severe headache with blurred vision', 'fits'],
    )
  if (has(String.raw`\b(forgot|forget|missed|miss|skipped)\b`) || has(String.raw`\b(take|have|give)\s+(two|2|double|extra)\b`))
    return answer(
      'Do not take a double dose to make up for a missed one. What to do depends on the medicine and how long it is until the next dose.',
      `Check the leaflet or the label today. ${ask}`,
      ['took too much and feels unwell', 'very sleepy or confused', 'chest pain or trouble breathing'],
    )
  if (has(String.raw`\b(how much|how many|what dose|which dose|dose of|dosage|how often|mg)\b`))
    return answer(
      'I cannot give an amount. The right dose depends on the medicine, age, weight and other health problems, especially for children and older people.',
      `Follow the prescription or the label. ${ask}`,
    )
  if (has(String.raw`\b(can|should|shall|may|could)\s+(i|we|he|she|they|you)\s+(stop|skip|quit|leave)\b|\b(stop|stopping|quit)\s+(\w+\s+){0,3}${MED}`))
    return answer(
      'Please do not stop a prescribed medicine by yourself, even if you feel well or your readings are normal. Readings are often normal because the medicine is working, and some medicines should not be stopped suddenly.',
      'Ask the doctor who prescribed it at your next chance, and sooner if you think it is causing a problem.',
    )
  if (has(String.raw`\b(with|together|along with|and)\b`) && has(String.raw`\b(can|should|safe|okay|ok)\b`) && (s.match(new RegExp(MED, 'gi'))?.length ?? 0) + (has('blood thinner') ? 1 : 0) >= 1 && has(String.raw`\b(with|together)\b`))
    return answer(
      'I cannot tell you whether these are safe together, because I have no checked medicine data. Some medicines do not mix, and with blood thinners the worry is bleeding.',
      `Ask a pharmacist before taking both, and show them everything being taken. ${ask}`,
      ['bleeding that will not stop', 'vomiting blood or black stools'],
    )
  return null
}
