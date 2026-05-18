// Placeholder types — sera généré automatiquement via `pnpm db:gen-types`
// après push migration initiale Supabase (Task 1.2).
//
// Commande à exécuter une fois le projet Supabase créé :
// $ supabase link --project-ref <YOUR_PROJECT_REF>
// $ pnpm db:gen-types
//
// Cf. supabase/migrations/20260518000000_init_schema.sql

export type Database = {
  public: {
    Tables: Record<string, never>
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
