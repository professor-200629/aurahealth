import { EMERGENCY_NUMBER, TEL_URI } from '../i18n'
import { Dual, Icon, useUi } from '../ui'

export function EmergencyCard({ titleKey = 'emergency.title', bodyKey = 'emergency.body', extraKey }: { titleKey?: string; bodyKey?: string; extraKey?: string }) {
  const { t } = useUi()
  return (
    <section className="sos-card stack" aria-labelledby="sos-title" data-testid="emergency-card">
      <div>
        <h2 id="sos-title">{t(titleKey)}</h2>
        <div className="sos-number" aria-hidden="true">
          {EMERGENCY_NUMBER}
        </div>
      </div>
      <Dual k={bodyKey} />
      <a className="btn sos block" href={TEL_URI}>
        <Icon name="phone" size={24} />
        {t('emergency.button')}
      </a>
      <div className="note">
        <Icon name="info" />
        <Dual k="emergency.dialerNote" />
      </div>
      <div className="note">
        <Icon name="alert" />
        <Dual k="emergency.needsNetwork" />
      </div>
      {extraKey && <Dual k={extraKey} className="small" />}
    </section>
  )
}
