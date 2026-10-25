import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { consultationAdminQueries, type B2cLiveMeeting } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { bookingStatusBadge } from "@/lib/status";
import { AppLink } from "@/components/ui/app-link";
import { Badge, Card, Empty, Loading, PageHead } from "@/components/ui/kit";
import { PageState } from "@/components/ui/primitives";
import { formatUtc } from "../lib";

/** mm:ss (or h:mm:ss) until `iso`, never negative. */
function countdown(iso: string | null | undefined, now: number): string {
  if (!iso) return "—";
  const total = Math.max(0, Math.floor((new Date(iso).getTime() - now) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function Seat({ who, name, here }: { who: string; name: string | null | undefined; here: boolean | null }) {
  return (
    <div className="ma-slotrow">
      <span className="ma-cell-flex">
        <strong>{who}</strong>
        <span>{name ?? "—"}</span>
      </span>
      {here === null ? (
        <Badge def={{ label: { ar: "غير معروف", en: "Unknown" }, tone: "neutral" }} />
      ) : here ? (
        <Badge def={{ label: { ar: "داخل الغرفة", en: "In the room" }, tone: "success" }} />
      ) : (
        <Badge def={{ label: { ar: "لم يدخل", en: "Not in the room" }, tone: "warning" }} />
      )}
    </div>
  );
}

function MeetingCard({ meeting, now }: { meeting: B2cLiveMeeting; now: number }) {
  const t = useT();
  const { booking: b } = meeting;
  const present = (role: "expert" | "customer") =>
    meeting.room_unavailable ? null : meeting.participants.some((p) => p.role === role && p.kind === "standard");
  const recorder = meeting.participants.some((p) => p.kind === "egress");
  const started = !!meeting.join_opens_at && new Date(meeting.join_opens_at).getTime() <= now;

  return (
    <Card
      title={
        <AppLink className="ma-link" to={`/consultations/bookings/${b.booking_id}`}>
          {b.product_title ?? t("استشارة", "Consultation")}
        </AppLink>
      }
      actions={<Badge def={bookingStatusBadge(b.status)} />}
    >
      <div className="ma-cell-flex" style={{ justifyContent: "space-between", marginBlockEnd: "var(--space-3)" }}>
        <span>
          {formatUtc(b.scheduled_start_at)} – {formatUtc(b.scheduled_end_at)}
        </span>
        <strong className="ma-num" title={t("المتبقي حتى الإغلاق", "Time until the room closes")}>
          {started ? countdown(meeting.hard_stop_at, now) : t("لم تفتح الغرفة", "Room not open yet")}
        </strong>
      </div>
      <div className="ma-slotlist">
        <Seat who={t("الخبير", "Expert")} name={b.expert_name} here={present("expert")} />
        <Seat who={t("الطالب", "Student")} name={b.customer_name} here={present("customer")} />
      </div>
      <div className="ma-cell-flex" style={{ marginBlockStart: "var(--space-3)" }}>
        <Badge
          def={
            meeting.room_unavailable
              ? { label: { ar: "تعذّر الاتصال بـ LiveKit", en: "LiveKit unreachable" }, tone: "danger" }
              : meeting.room_open
                ? { label: { ar: "الغرفة مفتوحة", en: "Room open" }, tone: "success" }
                : { label: { ar: "الغرفة غير مفتوحة", en: "Room not open" }, tone: "neutral" }
          }
        />
        {meeting.room_open ? (
          <Badge
            def={
              meeting.recording_active || recorder
                ? { label: { ar: "جارٍ التسجيل", en: "Recording" }, tone: "danger" }
                : { label: { ar: "لا تسجيل", en: "Not recording" }, tone: "warning" }
            }
          />
        ) : null}
      </div>
    </Card>
  );
}

export default function LiveMeetingsPage() {
  const t = useT();
  const live = useQuery(consultationAdminQueries.live());
  // Ticks every second so countdowns move between the 10-second refreshes.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <PageHead
        title={t("مباشر الآن", "Live now")}
        sub={t(
          "الجلسات المفتوحة الآن: من في الغرفة، هل التسجيل يعمل، والوقت المتبقي. يتحدّث تلقائيًا كل 10 ثوانٍ.",
          "Sessions that can be entered right now: who is in the room, whether it is recording and the time left. Refreshes every 10 seconds.",
        )}
      />
      <PageState error={live.error}>
        {live.isLoading ? <Loading /> : null}
        {live.data && !live.data.items.length ? (
          <Empty text={t("لا توجد جلسات مباشرة الآن.", "No sessions are live right now.")} icon="video" />
        ) : null}
        <div className="ma-cols ma-cols--2">
          {live.data?.items.map((meeting) => (
            <MeetingCard key={meeting.booking.booking_id} meeting={meeting} now={now} />
          ))}
        </div>
      </PageState>
    </>
  );
}
