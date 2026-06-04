-- quotes.sms_alert_state: SMS 알림 중복 차단 상태머신
-- 키: '__TOTAL__' (전체 견적) 또는 work_type 문자열
-- 값: 0=정상, 1=목표미달, 2=손실
-- 발송 직전 prev[key]와 비교해 악화된 것만 발송, 발송 후 nextState로 통째 교체
ALTER TABLE quotes ADD COLUMN sms_alert_state JSONB NOT NULL DEFAULT '{}'::jsonb;
