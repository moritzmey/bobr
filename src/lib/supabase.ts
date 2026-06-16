import { createClient, SupabaseClient } from "@supabase/supabase-js";

export interface TrainRunRow {
  id: number;
  service_date: string;
  train_number: string;
  category: string;
  origin: string;
  destination: string;
  sched_dep: string | null;
  sched_arr: string | null;
  max_delay: number;
  final_delay: number;
  cancelled: boolean;
  corridor: boolean;
  samples: number;
  first_seen: string;
  last_seen: string;
}

export type TrainRunUpsert = Omit<TrainRunRow, "id" | "first_seen"> & {
  first_seen?: string;
};

export interface TrainObservationRow {
  id: number;
  recorded_at: string;
  service_date: string;
  train_number: string;
  category: string;
  line_id: string | null;
  frac: number | null;
  delay_minutes: number;
  at_station: string | null;
  next_station: string | null;
}

export type TrainObservationInsert = Omit<TrainObservationRow, "id" | "recorded_at">;

export interface TrainStopEventRow {
  service_date: string;
  train_number: string;
  seq: number;
  station_id: string | null;
  station_name: string;
  sched_arr: string | null;
  act_arr: string | null;
  arr_delay: number | null;
  sched_dep: string | null;
  act_dep: string | null;
  dep_delay: number | null;
  updated_at: string;
}

export type TrainStopEventInsert = Omit<TrainStopEventRow, "updated_at">;

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
