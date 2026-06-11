import { createClient, SupabaseClient } from "@supabase/supabase-js";

export interface TrainSnapshotRow {
  id: number;
  recorded_at: string;
  train_number: string;
  category: string;
  direction: "BZ_BX" | "BX_BZ";
  scheduled_departure: string;
  delay_minutes: number;
  cancelled: boolean;
  origin_station: string;
  destination_station: string;
}

export type TrainSnapshotInsert = Omit<TrainSnapshotRow, "id" | "recorded_at">;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

let _client: AnyClient | null = null;

export function getSupabase(): AnyClient {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _client;
}

export function getSupabaseAdmin(): AnyClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
