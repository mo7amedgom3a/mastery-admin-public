import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { consultationAdminQueries, type B2cBooking } from "@/lib/api";
import { formatDurationSeconds } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { Alert, Button, Card, Dl, Empty, ErrorAlert, Loading } from "@/components/ui/kit";
import { formatUtc } from "../lib";

const RECORDING_LABEL: Record<string, { ar: string; en: string }> = {
  none: { ar: "لا تسجيل", en: "No recording" },
  recording: { ar: "جارٍ التسجيل", en: "Recording" },
  uploaded: { ar: "جاهز", en: "Ready" },
  failed: { ar: "فشل", en: "Failed" },
};

/** What happened in the room: join times, the recording and the whiteboard files. */
export function MeetingTab({ booking }: { booking: B2cBooking }) {
  const t = useT();
  const [playing, setPlaying] = useState(false);
  const hasRecording = booking.recording_status === "uploaded";
  const recording = useQuery({ ...consultationAdminQueries.recording(booking.booking_id), enabled: playing && hasRecording });
  const assets = useQuery(consultationAdminQueries.assets(booking.booking_id));
  const label = RECORDING_LABEL[booking.recording_status];

  return (
    <>
      <Card title={t("الجلسة", "Session")}>
        <Dl rows={[
          [t("الغرفة", "Room"), <bdi key="r">{booking.room_name ?? "—"}</bdi>],
          [t("دخول الطالب", "Student joined"), formatUtc(booking.customer_joined_at)],
          [t("دخول الخبير", "Expert joined"), formatUtc(booking.expert_joined_at)],
          [t("بدأت فعليًا", "Started"), formatUtc(booking.actual_started_at)],
          [t("انتهت", "Ended"), formatUtc(booking.actual_ended_at)],
          [t("سبب الانتهاء", "Ended because"), booking.ended_reason ?? "—"],
        ]} />
      </Card>

      <Card title={t("التسجيل", "Recording")}>
        <Dl rows={[
          [t("الحالة", "Status"), label ? t(label.ar, label.en) : booking.recording_status],
          [t("المدة", "Duration"), formatDurationSeconds(booking.recording_duration_seconds)],
          [t("يراه الطالب", "Visible to student"), booking.customer_recording_access ? t("نعم", "Yes") : t("لا (اختار الطالب عدم المشاركة)", "No (student opted out)")],
        ]} />
        {hasRecording ? (
          playing ? (
            <>
              {recording.isLoading ? <Loading /> : null}
              {recording.error ? <ErrorAlert error={recording.error} /> : null}
              {recording.data ? (
                <>
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption -- a session recording has no captions */}
                  <video className="ma-video" controls src={recording.data.url} />
                  <p className="ma-help">{t("الرابط مؤقت ويُسجَّل في سجل التدقيق.", "The link is short-lived and the view is audited.")}</p>
                </>
              ) : null}
            </>
          ) : (
            <Button kind="primary" icon="play" label={t("تشغيل التسجيل", "Play recording")} onClick={() => setPlaying(true)} />
          )
        ) : booking.recording_status === "failed" ? (
          <Alert kind="danger" title={t("فشل رفع التسجيل", "Recording upload failed")} />
        ) : null}
      </Card>

      <Card title={t("ملفات السبورة", "Whiteboard files")}>
        {assets.isLoading ? <Loading /> : null}
        {assets.error ? <ErrorAlert error={assets.error} /> : null}
        {assets.data && !assets.data.items.length ? <Empty text={t("لا ملفات.", "No files.")} icon="image" /> : null}
        <div className="ma-assets">
          {assets.data?.items.map((asset) => (
            <a key={asset.asset_id} href={asset.url} target="_blank" rel="noreferrer">
              <img src={asset.url} alt={asset.kind} loading="lazy" />
              <span className="ma-help">
                {asset.kind === "snapshot" ? t("لقطة السبورة", "Board snapshot") : t("صورة", "Image")} ·{" "}
                {asset.uploader_role === "expert" ? t("الخبير", "Expert") : t("الطالب", "Student")}
              </span>
            </a>
          ))}
        </div>
      </Card>
    </>
  );
}
