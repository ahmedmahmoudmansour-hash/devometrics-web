"use server";

import { createClient } from "@/lib/supabase/server";
import type { InstanceStep } from "./workflowTypes";

export async function getInstanceSteps(reviewId: string): Promise<InstanceStep[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("performance_review_instance_steps")
    .select("*")
    .eq("review_id", reviewId)
    .order("position", { ascending: true })
    .returns<InstanceStep[]>();
  return data ?? [];
}

export async function getInstanceStepsForReviews(reviewIds: string[]): Promise<Map<string, InstanceStep[]>> {
  const byReview = new Map<string, InstanceStep[]>();
  if (reviewIds.length === 0) return byReview;

  const supabase = await createClient();
  const { data } = await supabase
    .from("performance_review_instance_steps")
    .select("*")
    .in("review_id", reviewIds)
    .order("position", { ascending: true })
    .returns<InstanceStep[]>();

  for (const step of data ?? []) {
    const existing = byReview.get(step.review_id);
    if (existing) existing.push(step);
    else byReview.set(step.review_id, [step]);
  }
  return byReview;
}
