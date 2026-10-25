import { useT } from "@/lib/i18n";
import { PageHead } from "@/components/ui/kit";
import { BookingsTable } from "../components/bookings-table";

export default function ConsultationBookingsPage() {
  const t = useT();
  return (
    <>
      <PageHead title={t("حجوزات الاستشارات", "Consultation bookings")}
        sub={t("كل الحجوزات بما فيها الدفعات غير المكتملة. الأوقات بتوقيت UTC.", "Every booking, including unpaid checkouts. Times are UTC.")} />
      <BookingsTable />
    </>
  );
}
