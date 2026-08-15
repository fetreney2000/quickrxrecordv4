// ============================================================================
// TypeScript interfaces for QuickRxRecord v4
// Skema ini memadani jadual pangkalan data Supabase.
//
// Penamaan lajur menggunakan nama asal pangkalan data (snake_case).
// Lihat supabase/migrations/ untuk SQL yang sepadan.
// ============================================================================

// Roles (peranan_enum)
export type UserRole =
  | "Pentadbir"
  | "Penjaga Stor"
  | "Kakitangan Farmasi"
  | "Kakitangan Klinik";

// ============================================================================
// 1. profiles
// ============================================================================
export interface Profile {
  id: string;
  nama: string;
  jawatan: string | null;
  nama_pengguna: string;
  peranan: UserRole;
  aktif: boolean;
  kata_laluan_hash: string | null;
  created_at: string;
  updated_at: string;
  tema?: "light" | "dark" | null;
}

// ============================================================================
// 2. items (katalog ubat)
// ============================================================================
export interface Item {
  id: string;
  kod_item: string;
  nama_item: string;
  nama_dagangan: string | null;
  kekuatan: string | null;
  id_kategori: string | null;
  id_bentuk: string | null;
  kuota: number | null;
  catatan: string | null;
  aktif: boolean;
  created_at: string;
  updated_at: string;
}

// Tambah computed field untuk paparan UI (join dengan lookup)
export interface ItemWithLookups extends Item {
  item_categories?: { id: string; nama: string } | null;
  item_forms?: { id: string; nama: string } | null;
  bentuk?: string | null;
  // Pengiraan stok semasa dari item_batches
  stok_semasa?: number;
  // Pengiraan tugasan aktif (dari count_active_assignments)
  active_assignments?: number;
}

// ============================================================================
// 3. item_batches
// ============================================================================
export interface ItemBatch {
  id: string;
  item_id: string;
  nombor_kelompok: string;
  tarikh_luput: string;
  kuantiti: number;
  dilupuskan?: boolean;
  dilupuskan_at?: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// 4. patients
// ============================================================================
export interface Patient {
  id: string;
  nama: string;
  nombor_kad_pengenalan: string | null;
  nombor_pendaftaran_hospital: string | null;
  dokumen_lain: string | null;
  nombor_telefon: string | null;
  alamat: string | null;
  catatan: string | null;
  aktif: boolean;
  merged_into: string | null;
  tarikh_daftar: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// 5. patient_item_assignments
// ============================================================================
export interface PatientItemAssignment {
  id: string;
  patient_id: string;
  item_id: string;
  dos: string | null;
  tarikh_mula_guna: string;
  dimulakan_oleh: string | null;
  tarikh_tamat_guna: string | null;
  ditamatkan_oleh: string | null;
  kakitangan_farmasi_perekod: string | null;
  aktif: boolean;
  sebab_tamat: string | null;
  catatan_penggunaan: string | null;
  created_at: string;
  updated_at: string;
}

// Computed/joined view untuk UI
export interface AssignmentWithItem extends PatientItemAssignment {
  items?: Pick<Item, "id" | "kod_item" | "nama_item" | "nama_dagangan" | "kekuatan"> | null;
}

// ============================================================================
// 6. supply_records
// ============================================================================
export interface SupplyRecord {
  id: string;
  assignment_id: string;
  tarikh_dibekal: string;
  dos: string;
  tempoh_dibekal: string | null;
  kuantiti: number;
  batch_id: string | null;
  kakitangan_pembekal: string;
  catatan_bekalan: string | null;
  created_at: string;
}

// ============================================================================
// 7. dose_history
// ============================================================================
export interface DoseHistory {
  id: string;
  assignment_id: string;
  tarikh: string;
  dos: string;
  aktif: boolean;
  catatan: string | null;
  dikemaskini_oleh: string | null;
  created_at: string;
}

// ============================================================================
// 8. password_reset_requests
// ============================================================================
export interface PasswordResetRequest {
  id: string;
  user_id: string;
  requested_at: string;
  status: "pending" | "approved" | "rejected";
  resolved_by: string | null;
  resolved_at: string | null;
  notes: string | null;
}

// ============================================================================
// 9. batch_adjustments
// ============================================================================
export interface BatchAdjustment {
  id: string;
  batch_id: string;
  previous_kuantiti: number;
  new_kuantiti: number;
  change: number;
  reason: string | null;
  adjusted_by: string | null;
  catatan: string | null;
  created_at: string;
}

// ============================================================================
// 10. item_categories (lookup)
// ============================================================================
export interface ItemCategory {
  id: string;
  nama: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// 11. item_forms (lookup)
// ============================================================================
export interface ItemForm {
  id: string;
  nama: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// 12. supply_durations (lookup)
// ============================================================================
export interface SupplyDuration {
  id: string;
  nama: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// 13. staff_migration_lookup
// ============================================================================
export interface StaffMigrationLookup {
  old_id: number;
  profile_id: string;
  migrated_at: string;
}

// ============================================================================
// 14. inventory_transactions
// ============================================================================
export interface InventoryTransaction {
  id: string;
  item_id: string;
  batch_id: string | null;
  jenis: "masuk" | "keluar";
  kuantiti: number;
  rujukan_id: string | null;
  rujukan_type: string | null;
  catatan: string | null;
  created_at: string;
  /** Baki stok item selepas pergerakan ini. NULL untuk baris sebelum 2026-08-11. */
  baki?: number | null;
}

// ============================================================================
// Alias / Convenience
// ============================================================================

// Supply adalah alias untuk supply_records
export type Supply = SupplyRecord;

// ============================================================================
// "Ubat Tidak Perlu Dibekalkan" (supply declination)
// Rekod bahawa pesakit datang tetapi tidak perlu dibekalkan ubat.
// Tidak mengurangkan stok, tidak mencipta supply_records, tidak mengubah kuota.
// ============================================================================
export interface SupplyDeclination {
  id: string;
  assignment_id: string;
  tarikh: string;
  sebab: string;
  tempoh: string | null;
  catatan: string | null;
  direkod_oleh: string | null;
  created_at: string;
}

// Baris bersatu untuk "Sejarah Bekalan Ubat" (bekalan sebenar + "Tidak Perlu Dibekalkan")
export interface SupplyActivityRow {
  kind: "supply" | "declination";
  id: string;
  tarikh: string;
  laba_tarikh: boolean;
  // Supply sahaja
  dos?: string | null;
  tempoh_dibekal?: string | null;
  kuantiti?: number | null;
  kakitangan_pembekal?: string | null;
  kakitangan_pembekal_profile?: { id: string; nama: string } | null;
  // Declination sahaja
  sebab?: string | null;
  tempoh?: string | null;
  catatan?: string | null;
  direkod_oleh_profile?: { id: string; nama: string } | null;
}

// ============================================================================
// Types untuk Header search
// ============================================================================
export interface PatientSearchResult {
  id: string;
  nama: string;
  nombor_kad_pengenalan: string | null;
  nombor_pendaftaran_hospital: string | null;
}

// ============================================================================
// RBAC types
// ============================================================================
export type PermissionAction =
  | "manage_users"
  | "manage_items"
  | "manage_patients"
  | "manage_supply"
  | "view_reports"
  | "export_reports"
  | "merge_patients"
  | "manage_batches"
  | "view_items"
  | "view_patients"
  | "manage_assignments";

// ============================================================================
// Breadcrumb / Navigation types
// ============================================================================
export type NavSource = "list" | "search" | "default";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

// ============================================================================
// Database function return types
// ============================================================================

export interface ActiveAssignmentCount {
  item_id: string;
  active_count: number;
}
