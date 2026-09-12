/**
 * FR-015: the explanation shown in place of a card-type section that
 * currently has nothing to show, rather than an unexplained empty gap.
 */
import './insights.css';

export interface MissingDataNoticeProps {
  explanation: string;
}

export function MissingDataNotice({ explanation }: MissingDataNoticeProps) {
  return <p className="missing-data-notice">{explanation}</p>;
}
