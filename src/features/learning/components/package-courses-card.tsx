import { useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addPackageCourse,
  productKeys,
  productQueries,
  removePackageCourse,
  studioKeys,
  updatePackageCourse,
  type PackageCourse,
} from "@/lib/api";
import { useT } from "@/lib/i18n";
import { productHref, shortRef } from "@/lib/refs";
import { AppLink } from "@/components/ui/app-link";
import { Button, Card, Empty, ErrorAlert, Field, Loading } from "@/components/ui/kit";

/**
 * The courses a B2C package bundles: pick a course or diploma to add, mark each required/optional,
 * remove it. Used by the package tab and the package Studio. Every change refreshes the Studio's live
 * preview (`previewBase`) so the storefront package page shows the new members at once.
 */
export function PackageCoursesCard({ productRef, editable = true }: { productRef: string; editable?: boolean }) {
  const t = useT();
  const queryClient = useQueryClient();

  const coursesQuery = useQuery(productQueries.courses(productRef));
  const summaryQuery = useQuery(productQueries.summary(productRef));
  // Members are B2C products, so the picker lists B2C courses and diplomas. The API pages at 200; ask for
  // enough pages to cover the catalog (about 330 today).
  const optionPages = useQueries({
    queries: [0, 200, 400].map((offset) =>
      productQueries.list({ source: "b2c", product_type: "course,diploma", limit: 200, offset }),
    ),
  });
  const [pickId, setPickId] = useState("");

  const courses = useMemo(() => coursesQuery.data ?? [], [coursesQuery.data]);
  const bundled = useMemo(
    () => new Set(courses.map((course) => course.product_id).filter((id): id is string => Boolean(id))),
    [courses],
  );
  const options = useMemo(
    () =>
      optionPages
        .flatMap((page) => page.data?.items ?? [])
        .filter((item) => item.product_id && !bundled.has(item.product_id))
        .map((item): [string, string] => [item.product_id as string, item.title ?? item.slug ?? item.product_id ?? ""]),
    [optionPages, bundled],
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: productKeys.detail(productRef) });
    queryClient.invalidateQueries({ queryKey: productKeys.content(productRef, "courses") });
    queryClient.invalidateQueries({ queryKey: productKeys.content(productRef, "summary") });
    queryClient.invalidateQueries({ queryKey: studioKeys.previewBase(productRef) });
  };

  const addCourse = useMutation({
    mutationFn: (productId: string) => addPackageCourse(productRef, { product_id: productId, required: true }),
    onSuccess: () => {
      setPickId("");
      invalidate();
    },
  });
  const toggleRequired = useMutation({
    mutationFn: (course: PackageCourse) =>
      updatePackageCourse(productRef, course.product_id as string, { required: !course.required }),
    onSuccess: invalidate,
  });
  const removeCourse = useMutation({
    mutationFn: (course: PackageCourse) => removePackageCourse(productRef, course.product_id as string),
    onSuccess: invalidate,
  });

  if (coursesQuery.isLoading) return <Loading />;

  return (
    <Card
      title={t("دورات الحزمة", "Package courses")}
      actions={
        summaryQuery.data ? (
          <span className="ma-muted ma-num">
            {summaryQuery.data.courses} {t("دورة", "courses")}
          </span>
        ) : null
      }
    >
      <ErrorAlert error={coursesQuery.error ?? addCourse.error ?? toggleRequired.error ?? removeCourse.error} />

      {editable ? (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBlockEnd: 16 }}>
          <div style={{ flex: 1 }}>
            <Field
              id="pkg-pick"
              label={t("إضافة دورة للحزمة", "Add a course to the package")}
              value={pickId}
              onChange={setPickId}
              options={[["", t("اختر…", "Choose…")], ...options]}
            />
          </div>
          <Button label={t("إضافة", "Add")} disabled={!pickId || addCourse.isPending} onClick={() => addCourse.mutate(pickId)} />
        </div>
      ) : null}

      {courses.length === 0 ? (
        <Empty text={t("لا دورات في الحزمة بعد.", "No courses in this package yet.")} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {courses.map((course) => (
            <div
              key={course.product_id ?? course.course_ref}
              className="ma-cell-flex"
              style={{ justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--line)" }}
            >
              <span className="ma-cell-main">
                <AppLink className="ma-link" to={productHref(course.course_ref)}>
                  {course.title ?? shortRef(course.course_ref)}
                </AppLink>
                <span className="ma-cell-sub">{course.course_ref}</span>
              </span>
              {editable ? (
                <span className="ma-cell-flex" style={{ gap: 8 }}>
                  <Button
                    sm
                    kind={course.required ? "primary" : "secondary"}
                    label={course.required ? t("إلزامية", "Required") : t("اختيارية", "Optional")}
                    disabled={toggleRequired.isPending}
                    onClick={() => toggleRequired.mutate(course)}
                  />
                  <Button
                    sm
                    kind="danger"
                    label={t("إزالة", "Remove")}
                    disabled={removeCourse.isPending}
                    onClick={() => removeCourse.mutate(course)}
                  />
                </span>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
