/**
 * FR-014: every card's fixed shape — a claim, a period, a supporting
 * session count, and an optional link. This component renders the
 * shape; callers compute the wording from their own computed numbers
 * (never generated prose, §5.6).
 */
import { Link } from 'react-router-dom';
import './insights.css';

export interface InsightCardProps {
  claim: string;
  period: string;
  /** FR-014's "how many sessions support it" — composed by the caller
   * (e.g. "6 sessions", "20 sets", "6 of 12 weeks") since not every card
   * type's supporting evidence is literally a session count. */
  support: string;
  linkTo?: string;
  isPersonalRecord?: boolean;
}

export function InsightCard({
  claim,
  period,
  support,
  linkTo,
  isPersonalRecord,
}: InsightCardProps) {
  const content = (
    <>
      <p className="insight-card__claim">{claim}</p>
      <p className="insight-card__meta">
        {period} · {support}
      </p>
      {isPersonalRecord && (
        <span className="insight-card__pr-badge" aria-label="Personal record">
          PR
        </span>
      )}
    </>
  );

  if (linkTo) {
    return (
      <Link to={linkTo} className="insight-card">
        {content}
      </Link>
    );
  }

  return <div className="insight-card">{content}</div>;
}
