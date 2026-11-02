/* =========================================================
   GudangKita - Sistem Manajemen Stok & Peminjaman Gudang
   Data disimpan di localStorage (berfungsi sebagai "database"
   sisi klien). Semua modul: Barang, Peminjaman/Pengembalian,
   Barang Rusak/MT, Pembelian, Pengajuan Pembelian, Barang
   Hilang, dan Manajemen User.
   ========================================================= */

const DB_KEY = 'gudangkita_db_v1';
const SESSION_KEY = 'gudangkita_session_v1';

/* ---------- Util umum ---------- */
function uid(prefix) {
    return prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
// Mengembalikan tanggal hari ini dalam format 'YYYY-MM-DD' (untuk input date & pencatatan).
function todayStr() {
    return new Date().toISOString().slice(0, 10);
}
// Memformat sebuah tanggal menjadi format tampilan Indonesia (cth: 09 Sep 2026). Mengembalikan '-' jika kosong.
function fmtDate(d) {
    if (!d) return '-';
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}
// Memformat tanggal + waktu menjadi format tampilan Indonesia lengkap dengan jam:menit.
function fmtDateTime(d) {
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return dt.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
// Memformat angka menjadi string mata uang Rupiah (cth: 'Rp 15.000').
function fmtRupiah(n) {
    n = Number(n) || 0;
    return 'Rp ' + n.toLocaleString('id-ID');
}
// Meng-escape karakter HTML khusus (&, <, >, ", ') agar input pengguna aman disisipkan ke dalam HTML.
function escapeHtml(str) {
    if (str === undefined || str === null) return '';
    return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- Lampiran Pengajuan Pembelian ---------- */
const ATTACHMENT_ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
const ATTACHMENT_MAX_SIZE = 3 * 1024 * 1024; // 3MB per file (bisa disesuaikan 2-5MB)
const ATTACHMENT_MAX_COUNT = 5;              // batas jumlah file per pengajuan
// Memformat ukuran file (bytes) menjadi label KB/MB yang mudah dibaca.
function fmtFileSize(bytes) {
    if (!bytes) return '0 KB';
    const kb = bytes / 1024;
    return kb < 1024 ? `${kb.toFixed(0)} KB` : `${(kb / 1024).toFixed(1)} MB`;
}
// Mengecek apakah sebuah tipe MIME termasuk gambar (dipakai untuk menentukan cara preview lampiran).
function isImageAttachment(type) { return type && type.startsWith('image/'); }

/* ---------- Database (localStorage) ----------
   ITEMS_DATA_VERSION dinaikkan setiap kali daftar barang bawaan (import
   dari file Excel/data asli) diperbarui, supaya browser yang sudah
   punya data lama otomatis ikut diperbarui tanpa kehilangan riwayat
   peminjaman/pembelian/dll yang sudah dibuat. */
const ITEMS_DATA_VERSION = 2;
const IMPORTED_ITEMS = [
            { id: 'AK0001', name: 'AIR STAPPLER U', category: 'Alat Kerja', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'AK0002', name: 'BRAD NAILER I', category: 'Alat Kerja', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'AK0003', name: 'DONGCHENG BATRE', category: 'Alat Kerja', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'AK0004', name: 'CHARGER DONGCHENG', category: 'Alat Kerja', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'AK0005', name: 'BATRE DONGCHENG', category: 'Alat Kerja', stock: 3, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'AK0006', name: 'BOR BATRE', category: 'Alat Kerja', stock: 4, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'AK0007', name: 'CHARGER BOR BATRE', category: 'Alat Kerja', stock: 3, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'AK0008', name: 'BATRE BOR', category: 'Alat Kerja', stock: 14, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'AK0009', name: 'MESIN COMPRESSOR', category: 'Alat Kerja', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'AK0010', name: 'HOTGUN', category: 'Alat Kerja', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'AK0011', name: 'JIGSAW', category: 'Alat Kerja', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'AK0012', name: 'MESIN AMPLAS', category: 'Alat Kerja', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'AK0013', name: 'BOR LISTRIK', category: 'Alat Kerja', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'AK0014', name: 'MESIN LAS', category: 'Alat Kerja', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'AK0015', name: 'ROUTER', category: 'Alat Kerja', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'AK0016', name: 'MESIN POTONG MEJA 7\'', category: 'Alat Kerja', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'AK0017', name: 'MESIN POTONG DUDUK 7\'', category: 'Alat Kerja', stock: 0, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'AK0018', name: 'MESIN POTONG MEJA 14\'', category: 'Alat Kerja', stock: 0, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00001', name: 'GERABAH MILL&BAY 60CM PUTIH COKELAT', category: 'Dekorasi', stock: 6, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00002', name: 'GERABAH MILL&BAY 60CM PUTIH', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00003', name: 'GERABAH MILL&BAY 30CM MERAH BAMBU UKIR', category: 'Dekorasi', stock: 5, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00004', name: 'GERABAH MILL&BAY 35CM MOTIF UKIR', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00005', name: 'GERABAH MILL&BAY 50CM PUTIH BOTOL', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00006', name: 'GERABAH MILL&BAY 40CM GRADASI MERAH KUNING', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00007', name: 'GERABAH MILL&BAY 40CM GRADASI HIJAU KUNING', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00008', name: 'GERABAH MILL&BAY 120CM COKELAT', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00009', name: 'PETI KAYU 31X23X15', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00010', name: 'PETI KAYU 50X38X30', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00011', name: 'PETI KAYU 46X32X25', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00012', name: 'PETI KAYU 60X40X35', category: 'Dekorasi', stock: 7, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00013', name: 'LILIN 20CM ORIGINAL', category: 'Dekorasi', stock: 18, unit: 'pcs', location: 'Gudang Utama', rack: '1.18', minStock: 1 },
            { id: 'D00014', name: 'LILIN 28CM CREAM', category: 'Dekorasi', stock: 3, unit: 'pcs', location: 'Gudang Utama', rack: '1', minStock: 1 },
            { id: 'D00015', name: 'LILIN 30CM RED', category: 'Dekorasi', stock: 6, unit: 'pcs', location: 'Gudang Utama', rack: '1', minStock: 1 },
            { id: 'D00016', name: 'LILIN 28CM BLACK', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '1', minStock: 1 },
            { id: 'D00017', name: 'LILIN 15CM BLACK', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '1', minStock: 1 },
            { id: 'D00018', name: 'LILIN 10CM GREY', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '1', minStock: 1 },
            { id: 'D00019', name: 'LILIN 20CM ROSE', category: 'Dekorasi', stock: 4, unit: 'pcs', location: 'Gudang Utama', rack: '1', minStock: 1 },
            { id: 'D00020', name: 'LILIN 20CM ORANGE', category: 'Dekorasi', stock: 4, unit: 'pcs', location: 'Gudang Utama', rack: '1', minStock: 1 },
            { id: 'D00021', name: 'LILIN 20CM APPLE', category: 'Dekorasi', stock: 4, unit: 'pcs', location: 'Gudang Utama', rack: '1', minStock: 1 },
            { id: 'D00022', name: 'LILIN 20CM GOLD', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '1', minStock: 1 },
            { id: 'D00023', name: 'LILIN 4CM RED', category: 'Dekorasi', stock: 12, unit: 'pcs', location: 'Gudang Utama', rack: '1', minStock: 1 },
            { id: 'D00024', name: 'LILIN 20CM RED', category: 'Dekorasi', stock: 4, unit: 'pcs', location: 'Gudang Utama', rack: '1', minStock: 1 },
            { id: 'D00025', name: 'LILIN BATRE WHITE', category: 'Dekorasi', stock: 53, unit: 'pcs', location: 'Gudang Utama', rack: '1,7,18', minStock: 1 },
            { id: 'D00026', name: 'LILIN BATRE RED', category: 'Dekorasi', stock: 22, unit: 'pcs', location: 'Gudang Utama', rack: '1', minStock: 1 },
            { id: 'D00027', name: 'FRAME HOLDER 10X15 2FACE WHITE', category: 'Dekorasi', stock: 7, unit: 'pcs', location: 'Gudang Utama', rack: '2', minStock: 1 },
            { id: 'D00028', name: 'FRAME HOLDER 10X15 2FACE BLACK', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '2', minStock: 1 },
            { id: 'D00029', name: 'PHOTO FRAME 4R ROSE SILVER', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '2', minStock: 1 },
            { id: 'D00030', name: 'PHOTO FRAME 4R ROSE GOLD', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '2', minStock: 1 },
            { id: 'D00031', name: 'PHOTO FRAME 4R GREEN MATCHA', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '2', minStock: 1 },
            { id: 'D00032', name: 'PHOTO FRAME 4R SILVER', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '2', minStock: 1 },
            { id: 'D00033', name: 'PHOTO FRAME 3R UKIR GOLD', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '2', minStock: 1 },
            { id: 'D00034', name: 'PHOTO FRAME 10X10 KAIN UNGU', category: 'Dekorasi', stock: 3, unit: 'pcs', location: 'Gudang Utama', rack: '2', minStock: 1 },
            { id: 'D00035', name: 'MINIATUR TOPENG 25CM SILVER', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '2', minStock: 1 },
            { id: 'D00036', name: 'PHOTOBOOTH PROPS', category: 'Dekorasi', stock: 16, unit: 'pcs', location: 'Gudang Utama', rack: '2.26', minStock: 1 },
            { id: 'D00037', name: 'CUPCAKE STAND 3 TIERS DELICIA', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '2', minStock: 1 },
            { id: 'D00038', name: 'POT PAGAR DEKORASI 20X10X10 WHITE', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '2', minStock: 1 },
            { id: 'D00039', name: 'TOPLES KACA 20CM', category: 'Dekorasi', stock: 3, unit: 'pcs', location: 'Gudang Utama', rack: '3', minStock: 1 },
            { id: 'D00040', name: 'ONE TWO CUPS 20CM', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '3', minStock: 1 },
            { id: 'D00041', name: 'ONE TWO CUPS 15CM', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '3', minStock: 1 },
            { id: 'D00042', name: 'ONE TWO CUPS 12CM', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '3', minStock: 1 },
            { id: 'D00043', name: 'FISHBOWL DIA20CM T20CM', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '3', minStock: 1 },
            { id: 'D00044', name: 'VAS KERAMIK 0104S', category: 'Dekorasi', stock: 15, unit: 'pcs', location: 'Gudang Utama', rack: '3,16,28', minStock: 1 },
            { id: 'D00045', name: 'CANDLE CASE', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '3', minStock: 1 },
            { id: 'D00046', name: 'KACA SELONGSONG DIA8CM T9CM', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '3', minStock: 1 },
            { id: 'D00047', name: 'VAS KACA BOWL DIA8CM T8CM', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '3', minStock: 1 },
            { id: 'D00048', name: 'GELAS CARAFE T19CM', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '3', minStock: 1 },
            { id: 'D00049', name: 'GELAS CARAFE T20CM', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '3.16', minStock: 1 },
            { id: 'D00050', name: 'VAS VILJESTARK T17CM IKEA', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '3', minStock: 1 },
            { id: 'D00051', name: 'MAINAN SPIRAL RAINBOW', category: 'Dekorasi', stock: 58, unit: 'pcs', location: 'Gudang Utama', rack: '4', minStock: 1 },
            { id: 'D00052', name: 'RUBIK', category: 'Dekorasi', stock: 8, unit: 'pcs', location: 'Gudang Utama', rack: '4', minStock: 1 },
            { id: 'D00053', name: 'PIRINGAN HITAM', category: 'Dekorasi', stock: 39, unit: 'pcs', location: 'Gudang Utama', rack: '5.36', minStock: 1 },
            { id: 'D00054', name: 'KASET', category: 'Dekorasi', stock: 37, unit: 'pcs', location: 'Gudang Utama', rack: '5', minStock: 1 },
            { id: 'D00055', name: 'VAS KERAMIK 011S', category: 'Dekorasi', stock: 45, unit: 'pcs', location: 'Gudang Utama', rack: '6,15,16,28', minStock: 1 },
            { id: 'D00056', name: 'TUSCANY GLASS', category: 'Dekorasi', stock: 17, unit: 'pcs', location: 'Gudang Utama', rack: '6,29,44', minStock: 1 },
            { id: 'D00057', name: 'BRANDY GLASS DIA13CM T18', category: 'Dekorasi', stock: 5, unit: 'pcs', location: 'Gudang Utama', rack: '6', minStock: 1 },
            { id: 'D00058', name: 'LENTERA PUTIH T20CM IKEA', category: 'Dekorasi', stock: 23, unit: 'pcs', location: 'Gudang Utama', rack: '7,10,14', minStock: 1 },
            { id: 'D00059', name: 'ARCOROC BOWLS BLACK DIA8CM', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '8', minStock: 1 },
            { id: 'D00060', name: 'ARCOROC BOWLS BLACK DIA14CM', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '8', minStock: 1 },
            { id: 'D00061', name: 'ARCOROC BOWLS BLACK DIA23CM', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '8', minStock: 1 },
            { id: 'D00062', name: 'ARCOROC PLATE BLACK', category: 'Dekorasi', stock: 3, unit: 'pcs', location: 'Gudang Utama', rack: '8', minStock: 1 },
            { id: 'D00063', name: 'BOTOL KACA COKELAT T19CM', category: 'Dekorasi', stock: 4, unit: 'pcs', location: 'Gudang Utama', rack: '8.22', minStock: 1 },
            { id: 'D00064', name: 'BOTOL KACA GEPENG COKELAT T19CM', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '8', minStock: 1 },
            { id: 'D00065', name: 'CANGKIR VICENZA', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '8', minStock: 1 },
            { id: 'D00066', name: 'COLORADO GLASS', category: 'Dekorasi', stock: 30, unit: 'pcs', location: 'Gudang Utama', rack: '8,tba', minStock: 1 },
            { id: 'D00067', name: 'DRINKING JAR', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '8', minStock: 1 },
            { id: 'D00068', name: 'GELAS ACAR', category: 'Dekorasi', stock: 4, unit: 'pcs', location: 'Gudang Utama', rack: '8.22', minStock: 1 },
            { id: 'D00069', name: 'CLEAR JAR', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '8', minStock: 1 },
            { id: 'D00070', name: 'PURPLE SPECKLED GLASS', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '8', minStock: 1 },
            { id: 'D00071', name: 'CHANDELIER CRYSTAL DIA6CM', category: 'Dekorasi', stock: 4, unit: 'pcs', location: 'Gudang Utama', rack: '8', minStock: 1 },
            { id: 'D00072', name: 'BLUE POTTERY PLATE', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '8', minStock: 1 },
            { id: 'D00073', name: 'MUTIARA', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '9', minStock: 1 },
            { id: 'D00074', name: 'KAIN BIRU', category: 'Dekorasi', stock: 20, unit: 'pcs', location: 'Gudang Utama', rack: '11,SK2', minStock: 1 },
            { id: 'D00075', name: 'KAIN KERLAP KERLIP BIRU', category: 'Dekorasi', stock: 9, unit: 'pcs', location: 'Gudang Utama', rack: '11,SK2', minStock: 1 },
            { id: 'D00076', name: 'KAIN KERLAP KERLIP GOLD', category: 'Dekorasi', stock: 6, unit: 'pcs', location: 'Gudang Utama', rack: '12', minStock: 1 },
            { id: 'D00077', name: 'CANDLE HOLDER T45CM', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '13', minStock: 1 },
            { id: 'D00078', name: 'LAMPION', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '15', minStock: 1 },
            { id: 'D00079', name: 'PAPERCUP', category: 'Dekorasi', stock: 60, unit: 'pcs', location: 'Gudang Utama', rack: '15', minStock: 1 },
            { id: 'D00080', name: 'KOTAK SESERAHAN', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '15', minStock: 1 },
            { id: 'D00081', name: 'STICK ESKRIM PLASTIK', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '15', minStock: 1 },
            { id: 'D00082', name: 'LILIN ULANG TAHUN', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '15', minStock: 1 },
            { id: 'D00083', name: 'KERTAS KADO', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '15', minStock: 1 },
            { id: 'D00084', name: 'RANSEL ANAK', category: 'Dekorasi', stock: 14, unit: 'pcs', location: 'Gudang Utama', rack: '15', minStock: 1 },
            { id: 'D00085', name: 'PITA SERUT', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '15', minStock: 1 },
            { id: 'D00086', name: 'GELAS CARAFE T15CM', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '16', minStock: 1 },
            { id: 'D00087', name: 'BORRBY LENTERA 28CM', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '16', minStock: 1 },
            { id: 'D00088', name: 'GOTTGORA LENTERA 25CM', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '16', minStock: 1 },
            { id: 'D00089', name: 'SANGKAR DEKORASI 15CM', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '16', minStock: 1 },
            { id: 'D00090', name: 'SANGKAR DEKORASI 20CM', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '16', minStock: 1 },
            { id: 'D00091', name: 'SANGKAR DEKORASI 15CM', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '16', minStock: 1 },
            { id: 'D00092', name: 'ALOHA TOPLES 4L', category: 'Dekorasi', stock: 5, unit: 'pcs', location: 'Gudang Utama', rack: '17', minStock: 1 },
            { id: 'D00093', name: 'DREAM CATCHER WHITE', category: 'Dekorasi', stock: 4, unit: 'pcs', location: 'Gudang Utama', rack: '17', minStock: 1 },
            { id: 'D00094', name: 'SERVER ROUND 2LAYER INFORMA', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '18', minStock: 1 },
            { id: 'D00095', name: 'MC KATY PERANGKAT MAKAN', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '18', minStock: 1 },
            { id: 'D00096', name: 'GLASS CAKE DIA30CM', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '18', minStock: 1 },
            { id: 'D00097', name: 'VINTER CANDLE STICK 20CM IKEA', category: 'Dekorasi', stock: 6, unit: 'pcs', location: 'Gudang Utama', rack: '18', minStock: 1 },
            { id: 'D00098', name: 'LAMPU TIDUR HIAS 20CM', category: 'Dekorasi', stock: 3, unit: 'pcs', location: 'Gudang Utama', rack: '18', minStock: 1 },
            { id: 'D00099', name: 'GLASS CANDLE HOLDER 15CM', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '18', minStock: 1 },
            { id: 'D00100', name: 'GLASS CANDLE HOLDER 10CM', category: 'Dekorasi', stock: 14, unit: 'pcs', location: 'Gudang Utama', rack: '18', minStock: 1 },
            { id: 'D00101', name: 'GLASS CANDLE HOLDER SQUARE 5CM', category: 'Dekorasi', stock: 4, unit: 'pcs', location: 'Gudang Utama', rack: '18', minStock: 1 },
            { id: 'D00102', name: 'CANDLE DISH DIA18CM IKEA', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '18', minStock: 1 },
            { id: 'D00103', name: 'LILIN POETABLE BATRE T6CM MRDIY', category: 'Dekorasi', stock: 3, unit: 'pcs', location: 'Gudang Utama', rack: '18', minStock: 1 },
            { id: 'D00104', name: 'LILIN 20CM PINK', category: 'Dekorasi', stock: 8, unit: 'pcs', location: 'Gudang Utama', rack: '18', minStock: 1 },
            { id: 'D00105', name: 'PITA JEPANG HIJAU', category: 'Dekorasi', stock: 42, unit: 'pcs', location: 'Gudang Utama', rack: '19', minStock: 1 },
            { id: 'D00106', name: 'PITA JEPANG BIRU', category: 'Dekorasi', stock: 41, unit: 'pcs', location: 'Gudang Utama', rack: '19', minStock: 1 },
            { id: 'D00107', name: 'PITA JEPANG PINK', category: 'Dekorasi', stock: 40, unit: 'pcs', location: 'Gudang Utama', rack: '19', minStock: 1 },
            { id: 'D00108', name: 'CAKE LAYER 3 PUTIH', category: 'Dekorasi', stock: 14, unit: 'pcs', location: 'Gudang Utama', rack: '20', minStock: 1 },
            { id: 'D00109', name: 'CAKE LAYER 3 HIJAU', category: 'Dekorasi', stock: 16, unit: 'pcs', location: 'Gudang Utama', rack: '20', minStock: 1 },
            { id: 'D00110', name: 'BOLA DISKO BESAR', category: 'Dekorasi', stock: 15, unit: 'pcs', location: 'Gudang Utama', rack: '20', minStock: 1 },
            { id: 'D00111', name: 'BOLA DISKO KECIL', category: 'Dekorasi', stock: 13, unit: 'pcs', location: 'Gudang Utama', rack: '20', minStock: 1 },
            { id: 'D00112', name: 'TELENAN BATANG POHON', category: 'Dekorasi', stock: 9, unit: 'pcs', location: 'Gudang Utama', rack: '20', minStock: 1 },
            { id: 'D00113', name: 'SALT PAPER CASE BENTUK BURUNG', category: 'Dekorasi', stock: 6, unit: 'pcs', location: 'Gudang Utama', rack: '20', minStock: 1 },
            { id: 'D00114', name: 'PATUNG RUSA KUNO', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '20', minStock: 1 },
            { id: 'D00115', name: 'DECORATIVE VASE INFORMA T50CM', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '21', minStock: 1 },
            { id: 'D00116', name: 'LABU UKUR 1000ML', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '22', minStock: 1 },
            { id: 'D00117', name: 'BEAKER GLASS 500ML', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '22', minStock: 1 },
            { id: 'D00118', name: 'MEASURING CYLINDER', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '22', minStock: 1 },
            { id: 'D00119', name: 'ERLENMEYER 100ML', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '22', minStock: 1 },
            { id: 'D00120', name: 'ERLENMEYER 250ML', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '22', minStock: 1 },
            { id: 'D00121', name: 'KORKEN BOTOL T20CM IKEA', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '22', minStock: 1 },
            { id: 'D00122', name: 'CYCLONE GLASS T21CM', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '22', minStock: 1 },
            { id: 'D00123', name: 'KIG BOWL BLUE DIA12CM', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '22', minStock: 1 },
            { id: 'D00124', name: 'KIG BOWL BLUE DIA7CM', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '22', minStock: 1 },
            { id: 'D00125', name: 'TABLE NUMBER 10X20', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '22', minStock: 1 },
            { id: 'D00126', name: 'TABLE NUMBER 15X10', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '22', minStock: 1 },
            { id: 'D00127', name: 'TABLE NUMBER 15X20', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '22', minStock: 1 },
            { id: 'D00128', name: 'STAND CARD 10X20', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '22', minStock: 1 },
            { id: 'D00129', name: 'PIPET', category: 'Dekorasi', stock: 3, unit: 'pcs', location: 'Gudang Utama', rack: '22', minStock: 1 },
            { id: 'D00130', name: 'KAIN HITAM EVENT', category: 'Dekorasi', stock: 16, unit: 'pcs', location: 'Gudang Utama', rack: '23', minStock: 1 },
            { id: 'D00131', name: 'STETOSKOP HIJAU', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '24', minStock: 1 },
            { id: 'D00132', name: 'FEATHER PEN', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '24', minStock: 1 },
            { id: 'D00133', name: 'INTRODUCTORY ORGANIC SET', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '24', minStock: 1 },
            { id: 'D00134', name: 'BOTOL SCOT DURAN 400ML', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '24', minStock: 1 },
            { id: 'D00135', name: 'BOTOL SCOT DURAN 200ML', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '24', minStock: 1 },
            { id: 'D00136', name: 'BOTOL ASI', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '24', minStock: 1 },
            { id: 'D00137', name: 'SUNTIKAN MAINAN', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '24', minStock: 1 },
            { id: 'D00138', name: 'PASIR PANTAI KERANG', category: 'Dekorasi', stock: 10, unit: 'pcs', location: 'Gudang Utama', rack: '25', minStock: 1 },
            { id: 'D00139', name: 'CHALKBOARD 20X15', category: 'Dekorasi', stock: 4, unit: 'pcs', location: 'Gudang Utama', rack: '26', minStock: 1 },
            { id: 'D00140', name: 'CHALKBOARD 30X20', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '26', minStock: 1 },
            { id: 'D00141', name: 'LAMPU TIRAI KETUPAT', category: 'Dekorasi', stock: 4, unit: 'pcs', location: 'Gudang Utama', rack: '27', minStock: 1 },
            { id: 'D00142', name: 'GODAFTON IKEA', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '29', minStock: 1 },
            { id: 'D00143', name: 'CANDLE FLAMELESS TWILIGHT', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '29', minStock: 1 },
            { id: 'D00144', name: 'VASE GLASS ACE T25CM', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '29', minStock: 1 },
            { id: 'D00145', name: 'STOPEN IKEA', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '29', minStock: 1 },
            { id: 'D00146', name: 'LJUSANDE IKEA', category: 'Dekorasi', stock: 5, unit: 'pcs', location: 'Gudang Utama', rack: '29', minStock: 1 },
            { id: 'D00147', name: 'CONE TREE GOLD INFORMA T23CM', category: 'Dekorasi', stock: 6, unit: 'pcs', location: 'Gudang Utama', rack: '29.36', minStock: 1 },
            { id: 'D00148', name: 'WHISKEY DECANTER', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '29', minStock: 1 },
            { id: 'D00149', name: 'GLASS CANDLE HOLDER T15CM', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '29', minStock: 1 },
            { id: 'D00150', name: 'VTG COBALT TEAPOT BLUE', category: 'Dekorasi', stock: 3, unit: 'pcs', location: 'Gudang Utama', rack: '29', minStock: 1 },
            { id: 'D00151', name: 'VTG COBALT MUG BLUE', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '29', minStock: 1 },
            { id: 'D00152', name: 'VTG COBALT CREAMER CASE BLUE', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '29', minStock: 1 },
            { id: 'D00153', name: 'VTG COBALT GRAVY BOAT BLUE', category: 'Dekorasi', stock: 6, unit: 'pcs', location: 'Gudang Utama', rack: '29', minStock: 1 },
            { id: 'D00154', name: 'VTG COBALT MUG PLATE BLUE', category: 'Dekorasi', stock: 4, unit: 'pcs', location: 'Gudang Utama', rack: '29', minStock: 1 },
            { id: 'D00155', name: 'UMBUL UMBUL BALI T50CM', category: 'Dekorasi', stock: 4, unit: 'pcs', location: 'Gudang Utama', rack: '29', minStock: 1 },
            { id: 'D00156', name: 'PHOTO FRAME 5R TOSCA', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '29', minStock: 1 },
            { id: 'D00157', name: 'FISHBOWL T20CM DIA9CM', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '29', minStock: 1 },
            { id: 'D00158', name: 'VINTAGE ADDISON RUSS LONDON CLOCK', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '29', minStock: 1 },
            { id: 'D00159', name: 'GANTUNGAN BOHLAM NATAL', category: 'Dekorasi', stock: 12, unit: 'pcs', location: 'Gudang Utama', rack: '30', minStock: 1 },
            { id: 'D00160', name: 'GANTUNGAN POHON NATAL HIJAU', category: 'Dekorasi', stock: 72, unit: 'pcs', location: 'Gudang Utama', rack: '30', minStock: 1 },
            { id: 'D00161', name: 'GANTUNGAN KUDA SILVER', category: 'Dekorasi', stock: 20, unit: 'pcs', location: 'Gudang Utama', rack: '30', minStock: 1 },
            { id: 'D00162', name: 'SLING MERAH 4M', category: 'Dekorasi', stock: 7, unit: 'pcs', location: 'Gudang Utama', rack: '30', minStock: 1 },
            { id: 'D00163', name: 'SLING MERAH 2M', category: 'Dekorasi', stock: 6, unit: 'pcs', location: 'Gudang Utama', rack: '30', minStock: 1 },
            { id: 'D00164', name: 'JARING WHITE', category: 'Dekorasi', stock: 7, unit: 'pcs', location: 'Gudang Utama', rack: '30', minStock: 1 },
            { id: 'D00165', name: 'JARING GOLD', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '30', minStock: 1 },
            { id: 'D00166', name: 'TANGKAI CHERRY', category: 'Dekorasi', stock: 24, unit: 'pcs', location: 'Gudang Utama', rack: '30', minStock: 1 },
            { id: 'D00167', name: 'TANGKAI DAUN GREEN', category: 'Dekorasi', stock: 6, unit: 'pcs', location: 'Gudang Utama', rack: '30', minStock: 1 },
            { id: 'D00168', name: 'TANGKAI DAUN GOLD', category: 'Dekorasi', stock: 4, unit: 'pcs', location: 'Gudang Utama', rack: '30', minStock: 1 },
            { id: 'D00169', name: 'TANGKAI DAUN CREAM', category: 'Dekorasi', stock: 4, unit: 'pcs', location: 'Gudang Utama', rack: '30', minStock: 1 },
            { id: 'D00170', name: 'POHON NATAL MINI 10CM', category: 'Dekorasi', stock: 11, unit: 'pcs', location: 'Gudang Utama', rack: '31', minStock: 1 },
            { id: 'D00171', name: 'POHON NATAL MINI 15CM', category: 'Dekorasi', stock: 9, unit: 'pcs', location: 'Gudang Utama', rack: '31', minStock: 1 },
            { id: 'D00172', name: 'POHON NATAL MINI 20CM', category: 'Dekorasi', stock: 5, unit: 'pcs', location: 'Gudang Utama', rack: '31', minStock: 1 },
            { id: 'D00173', name: 'POHON NATALMINI 30CM', category: 'Dekorasi', stock: 4, unit: 'pcs', location: 'Gudang Utama', rack: '31', minStock: 1 },
            { id: 'D00174', name: 'GANTUNGAN PINTU NATAL DIA30CM', category: 'Dekorasi', stock: 4, unit: 'pcs', location: 'Gudang Utama', rack: '31', minStock: 1 },
            { id: 'D00175', name: 'GANTUNGAN PINTU NATAL DIA60CM', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '31', minStock: 1 },
            { id: 'D00176', name: 'PITA MAROON BLUDURU 30CM', category: 'Dekorasi', stock: 44, unit: 'pcs', location: 'Gudang Utama', rack: '31', minStock: 1 },
            { id: 'D00177', name: 'GANTUNGAN KAOSKAKI BESAR 40CM', category: 'Dekorasi', stock: 3, unit: 'pcs', location: 'Gudang Utama', rack: '32', minStock: 1 },
            { id: 'D00178', name: 'GANTUNGAN KAOSAKAKI SEDANG 30CM', category: 'Dekorasi', stock: 10, unit: 'pcs', location: 'Gudang Utama', rack: '32', minStock: 1 },
            { id: 'D00179', name: 'GANTUNGAN KAOSKAKI KECIL 25CM', category: 'Dekorasi', stock: 16, unit: 'pcs', location: 'Gudang Utama', rack: '32', minStock: 1 },
            { id: 'D00180', name: 'GANTUNGAN POHON NATAL SILVER', category: 'Dekorasi', stock: 23, unit: 'pcs', location: 'Gudang Utama', rack: '32', minStock: 1 },
            { id: 'D00181', name: 'GANTUNGAN MERRY CHRISMAST 60X20', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '32', minStock: 1 },
            { id: 'D00182', name: 'GANTUNGAN MERRY CHRISMAST 40X15', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '32', minStock: 1 },
            { id: 'D00183', name: 'GANTUNGAN MERRY CHRISMAST 30X15', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '32', minStock: 1 },
            { id: 'D00184', name: 'GANTUNGAN MERRY CHRISMAST 15X7', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '32', minStock: 1 },
            { id: 'D00185', name: 'GARLAND ARTIFICIAL SILVER 120CM', category: 'Dekorasi', stock: 13, unit: 'pcs', location: 'Gudang Utama', rack: '32', minStock: 1 },
            { id: 'D00186', name: 'GARLAND ARTIFICIAL GOLD 120CM', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '32', minStock: 1 },
            { id: 'D00187', name: 'GANTUNGAN PERMEN PAYUNG MERAH PUTIH', category: 'Dekorasi', stock: 113, unit: 'pcs', location: 'Gudang Utama', rack: '32', minStock: 1 },
            { id: 'D00188', name: 'GANTUNGAN PERMEN BALON MERAH PUTIH', category: 'Dekorasi', stock: 5, unit: 'pcs', location: 'Gudang Utama', rack: '32', minStock: 1 },
            { id: 'D00189', name: 'GANTUNGAN PERMEN PAYUNG MERAH', category: 'Dekorasi', stock: 13, unit: 'pcs', location: 'Gudang Utama', rack: '32', minStock: 1 },
            { id: 'D00190', name: 'GANTUNGAN PERMEN PAYUNG GOLD', category: 'Dekorasi', stock: 12, unit: 'pcs', location: 'Gudang Utama', rack: '32', minStock: 1 },
            { id: 'D00191', name: 'GANTUNGAN GINGERMAN MERAH', category: 'Dekorasi', stock: 9, unit: 'pcs', location: 'Gudang Utama', rack: '32', minStock: 1 },
            { id: 'D00192', name: 'BOLA CHERRY', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '32', minStock: 1 },
            { id: 'D00193', name: 'NUTRACKER BESAR', category: 'Dekorasi', stock: 3, unit: 'pcs', location: 'Gudang Utama', rack: '33', minStock: 1 },
            { id: 'D00194', name: 'NUTRACKER SEDANG', category: 'Dekorasi', stock: 11, unit: 'pcs', location: 'Gudang Utama', rack: '33', minStock: 1 },
            { id: 'D00195', name: 'NUTRACKER KECIL', category: 'Dekorasi', stock: 11, unit: 'pcs', location: 'Gudang Utama', rack: '33', minStock: 1 },
            { id: 'D00196', name: 'GANTUNGAN NUTRACKER SEDANG', category: 'Dekorasi', stock: 19, unit: 'pcs', location: 'Gudang Utama', rack: '33', minStock: 1 },
            { id: 'D00197', name: 'GANTUNGAN NUTRACKER KECIL', category: 'Dekorasi', stock: 16, unit: 'pcs', location: 'Gudang Utama', rack: '33', minStock: 1 },
            { id: 'D00198', name: 'LAMPU THUMBLER WARM (KABEL PUTIH)', category: 'Dekorasi', stock: 46, unit: 'pcs', location: 'Gudang Utama', rack: '34', minStock: 1 },
            { id: 'D00199', name: 'MILL&BAY WATER HYACINTH T30 DIA30', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00200', name: 'MILL&BAY WATER HYACINTH T25 DIA30', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00201', name: 'MILL&BAY WATER HYACINTH T35 DIA15', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00202', name: 'MILL&BAY WATER HYACINTH T35 DIA30', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00203', name: 'POT BUNGA ROTAN T45', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00204', name: 'LAMPU GANTUNG KRISTAL', category: 'Dekorasi', stock: 3, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00205', name: 'KAIN KERLAP KERLIP SILVER', category: 'Dekorasi', stock: 21, unit: 'pcs', location: 'Gudang Utama', rack: '35,SK5', minStock: 1 },
            { id: 'D00206', name: 'FIGURINE INFORMA', category: 'Dekorasi', stock: 3, unit: 'pcs', location: 'Gudang Utama', rack: '36', minStock: 1 },
            { id: 'D00207', name: 'UNIQUE BOTTLE', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '36', minStock: 1 },
            { id: 'D00208', name: 'ONE TWO CUPS PLATE GOLD DIA25', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '36', minStock: 1 },
            { id: 'D00209', name: 'ONYX DINNER PLATE', category: 'Dekorasi', stock: 5, unit: 'pcs', location: 'Gudang Utama', rack: '36', minStock: 1 },
            { id: 'D00210', name: 'CANDLE HOLDER KUNINGAN', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '36', minStock: 1 },
            { id: 'D00211', name: 'PATAKA DESK T35', category: 'Dekorasi', stock: 10, unit: 'pcs', location: 'Gudang Utama', rack: '36', minStock: 1 },
            { id: 'D00212', name: 'RESERVED TABLE SIGN 15X5', category: 'Dekorasi', stock: 6, unit: 'pcs', location: 'Gudang Utama', rack: '36', minStock: 1 },
            { id: 'D00213', name: 'TAMBANG DEKORASI BAJAK LAUT', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '37', minStock: 1 },
            { id: 'D00214', name: 'JARING IKAN', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '37', minStock: 1 },
            { id: 'D00215', name: 'TEROPONG BAJAK LAUT', category: 'Dekorasi', stock: 5, unit: 'pcs', location: 'Gudang Utama', rack: '37', minStock: 1 },
            { id: 'D00216', name: 'PEDANG BAJAK LAUT', category: 'Dekorasi', stock: 4, unit: 'pcs', location: 'Gudang Utama', rack: '37', minStock: 1 },
            { id: 'D00217', name: 'TUTUP MATA BAJAK LAUT', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '37', minStock: 1 },
            { id: 'D00218', name: 'BAN PELAMPUNG DUMMY', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '37', minStock: 1 },
            { id: 'D00219', name: 'SETIR KAPAL LAUT KECIL', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '37', minStock: 1 },
            { id: 'D00220', name: 'KERANG', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '37', minStock: 1 },
            { id: 'D00221', name: 'HANGING SKELETON', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00222', name: 'POHON AGLONEMA 90CM', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00223', name: 'BUNGA POT GOLD 65CM', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00224', name: 'TEDDY BEAR 150CM', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00225', name: 'TEDDY BEAR 90CM', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00226', name: 'TEDDY BEAR 60CM', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00227', name: 'STANDING TEDDY BEAR 65CM', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00228', name: 'STANDING MERRY MEYER 55CM', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00229', name: 'SANTA CLAUSE WHITE GOLD 30CM', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00230', name: 'TABLE LANTERN MAROCO INFORMA 50CM', category: 'Dekorasi', stock: 12, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00231', name: 'TABLE LANTERN MAROCO INFORMA 40CM', category: 'Dekorasi', stock: 10, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00232', name: 'TABLE LANTERN MAROCO INFORMA 35CM', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00233', name: 'TABLE LANTERN MAROCO INFORMA 30CM', category: 'Dekorasi', stock: 10, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00234', name: 'STEROFOAM RADIO', category: 'Dekorasi', stock: 13, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00235', name: 'STEROFOAM KAKTUS', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00236', name: 'KOTAK KADO NATAL', category: 'Dekorasi', stock: 50, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00237', name: 'KOTAK KADO NATAL BESEK', category: 'Dekorasi', stock: 25, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00238', name: 'KOTAK KADO NATAL TRANSPARAN', category: 'Dekorasi', stock: 10, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00239', name: 'KOTAK KADO NATAL KERTAS MINYAK', category: 'Dekorasi', stock: 28, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00240', name: 'GLOBE DIA30CM', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00241', name: 'GLOBE DIA20CM', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00242', name: 'POT GERABAH COKELAT 35CM', category: 'Dekorasi', stock: 5, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00243', name: 'SAYUR BUAH ARTIFICIAL', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00244', name: 'KOTAK POLYFOAM 20X20', category: 'Dekorasi', stock: 20, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00245', name: 'KOTAK POLYFOAM 40X40', category: 'Dekorasi', stock: 6, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00246', name: 'POT KECIL DAUN RUMBAI', category: 'Dekorasi', stock: 8, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00247', name: 'HMR BULAN SABIT 40CM', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00248', name: 'HMR BULAN SABIT 30CM', category: 'Dekorasi', stock: 18, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00249', name: 'HMR LAMPION 50CM', category: 'Dekorasi', stock: 4, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00250', name: 'HMR LAMPION 40CM', category: 'Dekorasi', stock: 16, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00251', name: 'GLITTERY HIASAN NATAL', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00252', name: 'GLITTERY HIASAN RAMADHAN', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00253', name: 'TOTEM JANGKAR 60CM', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00254', name: 'PAGAR PLASTIK 75X45', category: 'Dekorasi', stock: 6, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00255', name: 'PAGAR PLASTIK 60X30', category: 'Dekorasi', stock: 14, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00256', name: 'DRIED PHALANS', category: 'Dekorasi', stock: 22, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00257', name: 'ANYAMAN KECIL NATAL MIX', category: 'Dekorasi', stock: 22, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00258', name: 'PALEM KERING COKELAT', category: 'Dekorasi', stock: 11, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00259', name: 'PALEM KERING PINK', category: 'Dekorasi', stock: 5, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00260', name: 'OBOR BAMBU 90CM', category: 'Dekorasi', stock: 6, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00261', name: 'HMR KOTAK IMLEK 30X30', category: 'Dekorasi', stock: 12, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00262', name: 'LAMPION IMLEK PUTIH', category: 'Dekorasi', stock: 12, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00263', name: 'LAMPION IMLEK MERAH', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00264', name: 'LAMPION IMLEK KUNING', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00265', name: 'LAMPION IMLEK BIRU', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00266', name: 'BUNGA MAWAR KERTAS MIX', category: 'Dekorasi', stock: 20, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00267', name: 'XMAS DEER LIGHT STANDING 70X30', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00268', name: 'ANYAMAN KETUPAT BESAR', category: 'Dekorasi', stock: 39, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00269', name: 'ANYAMAN KETUPAT SEDANG', category: 'Dekorasi', stock: 20, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00270', name: 'ANYAMAN KETUPAT KECIL', category: 'Dekorasi', stock: 80, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00271', name: 'LAMPU THUMBLER WHITE (KABEL HITAM)', category: 'Dekorasi', stock: 35, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00272', name: 'LAMPU THUMBLER WARM (KABEL HITAM)', category: 'Dekorasi', stock: 12, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00273', name: 'FRAME PUTIH 45X34', category: 'Dekorasi', stock: 24, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00274', name: 'MATRAS PUZZLE 30X30', category: 'Dekorasi', stock: 90, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00275', name: 'XMAS POLY VILLAGE TRAIN WITH MUSIC', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00276', name: 'XMAS POLY VILLAGE FERRIS WHEEL', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00277', name: 'LAMPU TANGKAI HIAS BUNGA PUTIH', category: 'Dekorasi', stock: 10, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00278', name: 'GOTTGORA LANTERN 40CM', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00279', name: 'BULU ANGSA CREAM 50CM', category: 'Dekorasi', stock: 24, unit: 'pcs', location: 'Gudang Utama', rack: '38', minStock: 1 },
            { id: 'D00280', name: 'BULU ANGSA PUTIH 50CM', category: 'Dekorasi', stock: 6, unit: 'pcs', location: 'Gudang Utama', rack: '38', minStock: 1 },
            { id: 'D00281', name: 'BULU ANGSA COKELAT 50CM', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '38', minStock: 1 },
            { id: 'D00282', name: 'BULU ANGSA HITAM 50CM', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '38', minStock: 1 },
            { id: 'D00283', name: 'BULU ANGSA PUTIH 30CM', category: 'Dekorasi', stock: 11, unit: 'pcs', location: 'Gudang Utama', rack: '38', minStock: 1 },
            { id: 'D00284', name: 'LAMPU GANTUNG 10L WARM', category: 'Dekorasi', stock: 40, unit: 'pcs', location: 'Gudang Utama', rack: '39', minStock: 1 },
            { id: 'D00285', name: 'ROTATING GENIE LAMP', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '39', minStock: 1 },
            { id: 'D00286', name: 'VINTAGE GLASS BOTTLE 15CM', category: 'Dekorasi', stock: 10, unit: 'pcs', location: 'Gudang Utama', rack: '40 (MBAK MEN)', minStock: 1 },
            { id: 'D00287', name: 'NORDIC BOTTLE 13CM', category: 'Dekorasi', stock: 8, unit: 'pcs', location: 'Gudang Utama', rack: '40 (MBAK MEN)', minStock: 1 },
            { id: 'D00288', name: 'BOLA NATAL MERAH MIX', category: 'Dekorasi', stock: 404, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00289', name: 'BOLA NATAL GOLD MIX', category: 'Dekorasi', stock: 293, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00290', name: 'BOLA NATAL SILVER MIX', category: 'Dekorasi', stock: 323, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00291', name: 'BOLA NATAL HIJAU MIX', category: 'Dekorasi', stock: 55, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00292', name: 'BOLA NATAL BIRU MIX', category: 'Dekorasi', stock: 160, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00293', name: 'TAMPAH DIA60', category: 'Dekorasi', stock: 4, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00294', name: 'TAMPAH DIA55', category: 'Dekorasi', stock: 4, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00295', name: 'TAMPAH DIA40', category: 'Dekorasi', stock: 4, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00296', name: 'PORSELEN CHINA', category: 'Dekorasi', stock: 4, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00297', name: 'LED GLASS CANDLE 15CM', category: 'Dekorasi', stock: 8, unit: 'pcs', location: 'Gudang Utama', rack: '41', minStock: 1 },
            { id: 'D00298', name: 'BANTAL MOTIF MIX', category: 'Dekorasi', stock: 35, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00299', name: 'KARPET ROTAN', category: 'Dekorasi', stock: 5, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00300', name: 'TENDA INDIAN', category: 'Dekorasi', stock: 7, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00301', name: 'POHON NATAL PNP', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00302', name: 'LAMPU HIAS XMAS RED', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00303', name: 'LAMPU GANTUNG HIAS', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00304', name: 'LAMPU TAMAN', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00305', name: 'POT BUNGA ROTAN T38', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00306', name: 'KERANJANG PIKNIK ROTAN', category: 'Dekorasi', stock: 4, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00307', name: 'KERANJANG PIKNIK ROTAN DIA30', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00308', name: 'STANDING POHON NATAL 90CM', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00309', name: 'SELIMUT SALUR PUTIH 180X200', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: 'SK1', minStock: 1 },
            { id: 'D00310', name: 'SELIMUT MOTIF CATUR 180X40', category: 'Dekorasi', stock: 15, unit: 'pcs', location: 'Gudang Utama', rack: 'SK1', minStock: 1 },
            { id: 'D00311', name: 'KAIN MOTIF AWAN EX PELINDO', category: 'Dekorasi', stock: 17, unit: 'pcs', location: 'Gudang Utama', rack: 'SK1', minStock: 1 },
            { id: 'D00312', name: 'KAIN MOTIF BUNGA TROPIC', category: 'Dekorasi', stock: 16, unit: 'pcs', location: 'Gudang Utama', rack: 'SK1', minStock: 1 },
            { id: 'D00313', name: 'TAPLAK MOTIF AWAN EX PELINDO', category: 'Dekorasi', stock: 22, unit: 'pcs', location: 'Gudang Utama', rack: 'SK1', minStock: 1 },
            { id: 'D00314', name: 'KARPET MOTIF SONGKET', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: 'SK2', minStock: 1 },
            { id: 'D00315', name: 'KAIN MOTIF SONGKET', category: 'Dekorasi', stock: 3, unit: 'pcs', location: 'Gudang Utama', rack: 'SK2', minStock: 1 },
            { id: 'D00316', name: 'KARPET MOTIF PAKISTAN DUPATTA', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: 'SK2', minStock: 1 },
            { id: 'D00317', name: 'TAPLAK GREY 140X40', category: 'Dekorasi', stock: 26, unit: 'pcs', location: 'Gudang Utama', rack: 'SK2', minStock: 1 },
            { id: 'D00318', name: 'TAPLAK MOTIF KOTAK KUNING PUTIH 200X50', category: 'Dekorasi', stock: 20, unit: 'pcs', location: 'Gudang Utama', rack: 'SK2', minStock: 1 },
            { id: 'D00319', name: 'KAIN PUTIH BESAR', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: 'SK3', minStock: 1 },
            { id: 'D00320', name: 'KAIN PUTIH RENDA', category: 'Dekorasi', stock: 5, unit: 'pcs', location: 'Gudang Utama', rack: 'SK3', minStock: 1 },
            { id: 'D00321', name: 'KAIN PUTIH POTONG', category: 'Dekorasi', stock: 32, unit: 'pcs', location: 'Gudang Utama', rack: 'SK3', minStock: 1 },
            { id: 'D00322', name: 'KAIN PUTIH', category: 'Dekorasi', stock: 5, unit: 'pcs', location: 'Gudang Utama', rack: 'SK3,SK8', minStock: 1 },
            { id: 'D00323', name: 'KAIN KERLAP KERLIP PINK MUDA', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: 'SK4', minStock: 1 },
            { id: 'D00324', name: 'KAIN KERLAP KERLIP PINK TUA', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: 'SK4', minStock: 1 },
            { id: 'D00325', name: 'KAIN KERLAP KERLIP UNGU', category: 'Dekorasi', stock: 4, unit: 'pcs', location: 'Gudang Utama', rack: 'SK4', minStock: 1 },
            { id: 'D00326', name: 'TAPLAK MOTIF KOTAK MERAH PUTIH 200X50', category: 'Dekorasi', stock: 3, unit: 'pcs', location: 'Gudang Utama', rack: 'SK4', minStock: 1 },
            { id: 'D00327', name: 'TULLE GLITER UNGU', category: 'Dekorasi', stock: 3, unit: 'pcs', location: 'Gudang Utama', rack: 'SK4', minStock: 1 },
            { id: 'D00328', name: 'TULLE GLITER PINK', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: 'SK4', minStock: 1 },
            { id: 'D00329', name: 'TULLE GLITER PEACH', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: 'SK4', minStock: 1 },
            { id: 'D00330', name: 'OSTRICH PINK', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: 'SK4', minStock: 1 },
            { id: 'D00331', name: 'KAIN UNGU RENDA', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: 'SK4', minStock: 1 },
            { id: 'D00332', name: 'KAIN PINK RENDA', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: 'SK4', minStock: 1 },
            { id: 'D00333', name: 'KAIN PINK MUDA', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: 'SK4', minStock: 1 },
            { id: 'D00334', name: 'KAIN PINK TUA', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: 'SK4', minStock: 1 },
            { id: 'D00335', name: 'TAPLAK PINK RENDA', category: 'Dekorasi', stock: 6, unit: 'pcs', location: 'Gudang Utama', rack: 'SK4', minStock: 1 },
            { id: 'D00336', name: 'TAPLAK PINK', category: 'Dekorasi', stock: 5, unit: 'pcs', location: 'Gudang Utama', rack: 'SK4', minStock: 1 },
            { id: 'D00337', name: 'TAPLAK GOLD', category: 'Dekorasi', stock: 18, unit: 'pcs', location: 'Gudang Utama', rack: 'SK5', minStock: 1 },
            { id: 'D00338', name: 'LIST RENDA GOLD', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: 'SK5', minStock: 1 },
            { id: 'D00339', name: 'LIST TAPLAK MEJA GOLD', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: 'SK5', minStock: 1 },
            { id: 'D00340', name: 'TAPLAK KARUNG GOLD', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: 'SK5', minStock: 1 },
            { id: 'D00341', name: 'KAIN GOLD', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: 'SK5', minStock: 1 },
            { id: 'D00342', name: 'KAIN COKELAT CHIFON', category: 'Dekorasi', stock: 8, unit: 'pcs', location: 'Gudang Utama', rack: 'SK5', minStock: 1 },
            { id: 'D00343', name: 'KAIN HIJAU MUDA CHIFON', category: 'Dekorasi', stock: 3, unit: 'pcs', location: 'Gudang Utama', rack: 'SK5', minStock: 1 },
            { id: 'D00344', name: 'KAIN TOSCA CHIFON', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: 'SK5', minStock: 1 },
            { id: 'D00345', name: 'KAIN HIJAU', category: 'Dekorasi', stock: 4, unit: 'pcs', location: 'Gudang Utama', rack: 'SK5', minStock: 1 },
            { id: 'D00346', name: 'TAPLAK MATCHA', category: 'Dekorasi', stock: 5, unit: 'pcs', location: 'Gudang Utama', rack: 'SK5', minStock: 1 },
            { id: 'D00347', name: 'TAPLAK BIRU BESAR RENDA GOLD', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: 'SK6', minStock: 1 },
            { id: 'D00348', name: 'TAPLAK BIRU LAUT', category: 'Dekorasi', stock: 20, unit: 'pcs', location: 'Gudang Utama', rack: 'SK6', minStock: 1 },
            { id: 'D00349', name: 'KAIN BIRU LAUT', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: 'SK6', minStock: 1 },
            { id: 'D00350', name: 'KAIN BIRU MUDA CHIFON', category: 'Dekorasi', stock: 4, unit: 'pcs', location: 'Gudang Utama', rack: 'SK6', minStock: 1 },
            { id: 'D00351', name: 'KAIN BIRU MUDA', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: 'SK6', minStock: 1 },
            { id: 'D00352', name: 'TAPLAK MOTIF KOTAK BIRU PUTIH', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: 'SK6', minStock: 1 },
            { id: 'D00353', name: 'TAPLAK BIRU MUDA RENDA', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: 'SK6', minStock: 1 },
            { id: 'D00354', name: 'TAPLAK BIRU TUA', category: 'Dekorasi', stock: 23, unit: 'pcs', location: 'Gudang Utama', rack: 'SK6,SK2', minStock: 1 },
            { id: 'D00355', name: 'TAPLAK HITAM', category: 'Dekorasi', stock: 17, unit: 'pcs', location: 'Gudang Utama', rack: 'SK6', minStock: 1 },
            { id: 'D00356', name: 'KAIN MAROON BLUDRU', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: 'SK7', minStock: 1 },
            { id: 'D00357', name: 'KAIN MAROON', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: 'SK7', minStock: 1 },
            { id: 'D00358', name: 'HORDENG MERAH', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: 'SK7', minStock: 1 },
            { id: 'D00359', name: 'KAIN MIX', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: 'SK8', minStock: 1 },
            { id: 'D00360', name: 'KAIN IVORY', category: 'Dekorasi', stock: 7, unit: 'pcs', location: 'Gudang Utama', rack: 'SK8', minStock: 1 },
            { id: 'D00361', name: 'BOLA', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '42 (EX AXIS)', minStock: 1 },
            { id: 'D00362', name: 'POMPA', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '42 (EX AXIS)', minStock: 1 },
            { id: 'D00363', name: 'PLUIT', category: 'Dekorasi', stock: 4, unit: 'pcs', location: 'Gudang Utama', rack: '42 (EX AXIS)', minStock: 1 },
            { id: 'D00364', name: 'HORN', category: 'Dekorasi', stock: 3, unit: 'pcs', location: 'Gudang Utama', rack: '42 (EX AXIS)', minStock: 1 },
            { id: 'D00365', name: 'SCORE BOARD', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '42 (EX AXIS)', minStock: 1 },
            { id: 'D00366', name: 'GELAS CRYSTAL', category: 'Dekorasi', stock: 6, unit: 'pcs', location: 'Gudang Utama', rack: '43', minStock: 1 },
            { id: 'D00367', name: 'SLATE COASTER', category: 'Dekorasi', stock: 3, unit: 'pcs', location: 'Gudang Utama', rack: '43', minStock: 1 },
            { id: 'D00368', name: 'SANGO TEA CUP SET', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '44', minStock: 1 },
            { id: 'D00369', name: 'HIASAN PIRING GANTUNG MOTIF BUNGA', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '44', minStock: 1 },
            { id: 'D00370', name: 'STYVES BOWL CUP', category: 'Dekorasi', stock: 3, unit: 'pcs', location: 'Gudang Utama', rack: '44', minStock: 1 },
            { id: 'D00371', name: 'INFORMA GLASS JAR 950ML', category: 'Dekorasi', stock: 3, unit: 'pcs', location: 'Gudang Utama', rack: '45', minStock: 1 },
            { id: 'D00372', name: 'PORSELEN 230CC CUP D SAVER', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '45', minStock: 1 },
            { id: 'D00373', name: 'CANDY BOWL', category: 'Dekorasi', stock: 16, unit: 'pcs', location: 'Gudang Utama', rack: '45', minStock: 1 },
            { id: 'D00374', name: 'CAKE STAND', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '45', minStock: 1 },
            { id: 'D00375', name: 'ROUND JAR WITH LID 3000ML', category: 'Dekorasi', stock: 3, unit: 'pcs', location: 'Gudang Utama', rack: '45', minStock: 1 },
            { id: 'D00376', name: 'TOPENG HITAM WOMEN', category: 'Dekorasi', stock: 10, unit: 'pcs', location: 'Gudang Utama', rack: '46', minStock: 1 },
            { id: 'D00377', name: 'TOPENG HITAM WOMEN W/TIANG', category: 'Dekorasi', stock: 14, unit: 'pcs', location: 'Gudang Utama', rack: '46', minStock: 1 },
            { id: 'D00378', name: 'DUMMY BOOK', category: 'Dekorasi', stock: 17, unit: 'pcs', location: 'Gudang Utama', rack: '46', minStock: 1 },
            { id: 'D00379', name: 'DUMMY METERAN LISTRIK', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '46', minStock: 1 },
            { id: 'D00380', name: 'TOPI BAJAK LAUT', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '46', minStock: 1 },
            { id: 'D00381', name: 'PIRING LIST EMAS DIA9', category: 'Dekorasi', stock: 18, unit: 'pcs', location: 'Gudang Utama', rack: '47', minStock: 1 },
            { id: 'D00382', name: 'PHOTO FRAME 5R MOTIF KERANG', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '47', minStock: 1 },
            { id: 'D00383', name: 'PHOTO FRAME 4R UKIR GOLD', category: 'Dekorasi', stock: 4, unit: 'pcs', location: 'Gudang Utama', rack: '47', minStock: 1 },
            { id: 'D00384', name: 'PHOTO FRAME 5R BROWN', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '47', minStock: 1 },
            { id: 'D00385', name: 'STEROFOAM LAMPU ALADIN', category: 'Dekorasi', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00386', name: 'VAS BUNGA KERANJANG', category: 'Dekorasi', stock: 13, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00387', name: 'ORNAMEN SALJU', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00388', name: 'FLAMELESS CANDLE INFORMA', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '29', minStock: 1 },
            { id: 'D00389', name: 'BAKI KAYU 30X20X5', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00390', name: 'LETTER BOARD 30X30', category: 'Dekorasi', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'D00391', name: 'ACRYLIC SIGNAGE DISPLAY A6', category: 'Dekorasi', stock: 12, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'ES0001', name: 'PRINTER EPSON L3210', category: 'Elektronik', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'ES0002', name: 'PRINTER EPSON L3211', category: 'Elektronik', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'ES0003', name: 'PRINTER BROTHER', category: 'Elektronik', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'ES0004', name: 'LG TV 55"', category: 'Elektronik', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'ES0005', name: 'LG TV 43"', category: 'Elektronik', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'ES0006', name: 'MATADOR TV', category: 'Elektronik', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'ES0007', name: 'IGLOO COOLER BOX GREY', category: 'Elektronik', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'ES0008', name: 'HT', category: 'Elektronik', stock: 15, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'ES0009', name: 'BACKDROP PORTABLE', category: 'Elektronik', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'ES0010', name: 'TROLEY DORONG', category: 'Elektronik', stock: 3, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'ES0011', name: 'TROLEY TARIK', category: 'Elektronik', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'ES0012', name: 'SCAFOLDING', category: 'Elektronik', stock: 3, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'ES0013', name: 'TRIPOD SIGNAGE', category: 'Elektronik', stock: 39, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'ES0014', name: 'RAM', category: 'Elektronik', stock: 16, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'ES0015', name: 'KRISBOW CLEANING SET', category: 'Elektronik', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'ES0016', name: 'MISTYFAN', category: 'Elektronik', stock: 3, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'ES0017', name: 'STANDING TV', category: 'Elektronik', stock: 3, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'ES0018', name: 'VACUUM CLEANER AERO21 INOX', category: 'Elektronik', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'ES0019', name: 'VACUUM HAN RIVER', category: 'Elektronik', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'ES0020', name: 'KULKAS MINIBAR GEA 89L GMB91', category: 'Elektronik', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'ES0021', name: 'KULKAS MINIBAR GEA 46L GMB50', category: 'Elektronik', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'ES0022', name: 'NOISE SPEAKER 12\'', category: 'Elektronik', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'ES0023', name: 'SAFETY HELMET BIRU', category: 'Elektronik', stock: 10, unit: 'pcs', location: 'Gudang Utama', rack: '48', minStock: 1 },
            { id: 'ES0024', name: 'SAFETY HELMET KUNING', category: 'Elektronik', stock: 41, unit: 'pcs', location: 'Gudang Utama', rack: '48', minStock: 1 },
            { id: 'ES0025', name: 'SAFETY HELMET ORANGE', category: 'Elektronik', stock: 6, unit: 'pcs', location: 'Gudang Utama', rack: '48', minStock: 1 },
            { id: 'ES0026', name: 'SAFETY ROMPI HIJAU', category: 'Elektronik', stock: 63, unit: 'pcs', location: 'Gudang Utama', rack: '48', minStock: 1 },
            { id: 'ES0027', name: 'SAFETY ROMPI KUNING', category: 'Elektronik', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '48', minStock: 1 },
            { id: 'ES0028', name: 'SAFETY ROMPI ORANGE', category: 'Elektronik', stock: 35, unit: 'pcs', location: 'Gudang Utama', rack: '48', minStock: 1 },
            { id: 'ES0029', name: 'BODY HARNES', category: 'Elektronik', stock: 6, unit: 'pcs', location: 'Gudang Utama', rack: '48', minStock: 1 },
            { id: 'ES0030', name: 'SARUNG TANGAN LISTRIK', category: 'Elektronik', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '48', minStock: 1 },
            { id: 'ES0031', name: 'ACRYLIC A5 2 KAKI', category: 'Elektronik', stock: 18, unit: 'pcs', location: 'Gudang Utama', rack: '49', minStock: 1 },
            { id: 'ES0032', name: 'ACRYLIC A5 1 KAKI', category: 'Elektronik', stock: 6, unit: 'pcs', location: 'Gudang Utama', rack: '49', minStock: 1 },
            { id: 'ES0033', name: 'ACRYLIC A4 2 KAKI', category: 'Elektronik', stock: 16, unit: 'pcs', location: 'Gudang Utama', rack: '49', minStock: 1 },
            { id: 'ES0034', name: 'ACRYLIC A4 1 KAKI', category: 'Elektronik', stock: 4, unit: 'pcs', location: 'Gudang Utama', rack: '49', minStock: 1 },
            { id: 'ES0035', name: 'STAND ACRYLIC 9X7', category: 'Elektronik', stock: 13, unit: 'pcs', location: 'Gudang Utama', rack: '49', minStock: 1 },
            { id: 'ES0036', name: 'STAND ACRYLIC SIM/CARD HOLDER', category: 'Elektronik', stock: 4, unit: 'pcs', location: 'Gudang Utama', rack: '49', minStock: 1 },
            { id: 'ES0037', name: 'ACRYLIC BROSUR HOLDER BESAR', category: 'Elektronik', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '49', minStock: 1 },
            { id: 'ES0038', name: 'ACRYLIC BROSUR HOLDER KECIL', category: 'Elektronik', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '49', minStock: 1 },
            { id: 'ES0039', name: 'ACRYLIC SEGITIGA 7X30', category: 'Elektronik', stock: 13, unit: 'pcs', location: 'Gudang Utama', rack: '49', minStock: 1 },
            { id: 'ES0040', name: 'ACRYLIC SEGITIGA 7X25', category: 'Elektronik', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '49', minStock: 1 },
            { id: 'ES0041', name: 'ACRYLIC SEGITGA 8X30', category: 'Elektronik', stock: 3, unit: 'pcs', location: 'Gudang Utama', rack: '49', minStock: 1 },
            { id: 'ES0042', name: 'ACRYLIC TABLE A6', category: 'Elektronik', stock: 10, unit: 'pcs', location: 'Gudang Utama', rack: '49', minStock: 1 },
            { id: 'ES0043', name: 'SANDBAG', category: 'Elektronik', stock: 8, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'ES0044', name: 'SETERIKA UAP ARIETE', category: 'Elektronik', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'ES0045', name: 'MEASURING  TAPE', category: 'Elektronik', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'ES0046', name: 'PAYUNG', category: 'Elektronik', stock: 14, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'ES0047', name: 'TRASHBIN STORA 10L', category: 'Elektronik', stock: 12, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'ES0048', name: 'TEKO LISTRIK', category: 'Elektronik', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'ES0049', name: 'TOTE BAG TERPAL', category: 'Elektronik', stock: 4, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'ES0050', name: 'KASUR ANGIN BESTWAY', category: 'Elektronik', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'ES0051', name: 'BENDERA MERAH PUTIH 136X90', category: 'Elektronik', stock: 6, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'ES0052', name: 'PATAKA', category: 'Elektronik', stock: 6, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'ES0053', name: 'SAFETY SHOES', category: 'Elektronik', stock: 31, unit: 'pcs', location: 'Gudang Utama', rack: '48', minStock: 1 },
            { id: 'ES0054', name: 'SAFETY ROMPI BIRU MUDA', category: 'Elektronik', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'ES0055', name: 'SAFETY ROMPI BIRU TUA', category: 'Elektronik', stock: 0, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'ES0056', name: 'METERAN ROLL', category: 'Elektronik', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'ES0057', name: 'POINTER LASER', category: 'Elektronik', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'ES0058', name: 'KUNCI SHOCK', category: 'Elektronik', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'ES0059', name: 'SAFETY HELMET PUTIH', category: 'Elektronik', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'ES0060', name: 'BAKI KAYU IKEA PUTH 57X37', category: 'Elektronik', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'FU0001', name: 'BARSTOOL', category: 'Furniture', stock: 6, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'FU0002', name: 'MEJA LESEHAN', category: 'Furniture', stock: 10, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'FU0003', name: 'PUFF CHAIR BIRU', category: 'Furniture', stock: 5, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'FU0004', name: 'PUFF CHAIR PUTIH', category: 'Furniture', stock: 4, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'FU0005', name: 'RAK SUSUN 40X60X160', category: 'Furniture', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'FU0006', name: 'RAK BROSUR SUSUN PUTIH', category: 'Furniture', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'FU0007', name: 'COFFEE TABLE PUTIH', category: 'Furniture', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'FU0008', name: 'PODIUM ACRYLIC', category: 'Furniture', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'FU0009', name: 'MEJA BAKSO', category: 'Furniture', stock: 8, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'FU0010', name: 'KURSI BAKSO', category: 'Furniture', stock: 20, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'FU0011', name: 'BENCH MERAH', category: 'Furniture', stock: 4, unit: 'pcs', location: 'Gudang Utama', rack: '', minStock: 1 },
            { id: 'SS0001', name: 'KABEL AKAI TO XLR 25M', category: 'Sound System', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: 'CONT SOUND', minStock: 1 },
            { id: 'SS0002', name: 'KABEK AKAI TO XLR 2m', category: 'Sound System', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: 'CONT SOUND', minStock: 1 },
            { id: 'SS0003', name: 'KABEL JACK 3.5', category: 'Sound System', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: 'CONT SOUND', minStock: 1 },
            { id: 'SS0004', name: 'KABEL XLR TO XLR 5m', category: 'Sound System', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: 'CONT SOUND', minStock: 1 },
            { id: 'SS0005', name: 'KABEL XLR TO XLR 10m', category: 'Sound System', stock: 4, unit: 'pcs', location: 'Gudang Utama', rack: 'CONT SOUND', minStock: 1 },
            { id: 'SS0006', name: 'KABEL XLR MALE TO JACK 3.5 1m', category: 'Sound System', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: 'CONT SOUND', minStock: 1 },
            { id: 'SS0007', name: 'QA MIC WIREESS', category: 'Sound System', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: 'CONT SOUND', minStock: 1 },
            { id: 'MM0001', name: 'KABEL LAN 5M', category: 'Multimedia', stock: 3, unit: 'pcs', location: 'Gudang Utama', rack: 'CONT MULMED', minStock: 1 },
            { id: 'MM0002', name: 'WIRELES RECEIVER TRANSMITTER', category: 'Multimedia', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: 'CONT MULMED', minStock: 1 },
            { id: 'MM0003', name: 'KABEL FO AUDIO NYK 1.5M', category: 'Multimedia', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: 'CONT MULMED', minStock: 1 },
            { id: 'MM0004', name: 'HEADSET LOGITEC', category: 'Multimedia', stock: 3, unit: 'pcs', location: 'Gudang Utama', rack: 'CONT MULMED', minStock: 1 },
            { id: 'MM0005', name: 'BLUETOOTH DONGLE 5.0', category: 'Multimedia', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: 'CONT MULMED', minStock: 1 },
            { id: 'MM0006', name: 'HEADPHONE SPLITTER 3.5MM 6PORT', category: 'Multimedia', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: 'CONT MULMED', minStock: 1 },
            { id: 'MM0007', name: 'ORBIT TELKOMSEL', category: 'Multimedia', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: 'CONT MULMED', minStock: 1 },
            { id: 'MM0008', name: 'USB 6 PORT', category: 'Multimedia', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: 'CONT MULMED', minStock: 1 },
            { id: 'MM0009', name: 'KABEL 3.5MM TO RCA STEREO 1M', category: 'Multimedia', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: 'CONT MULMED', minStock: 1 },
            { id: 'MM0010', name: 'TOSLINK CABLE', category: 'Multimedia', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: 'CONT MULMED', minStock: 1 },
            { id: 'MM0011', name: 'HDMI VIDEO CAPTURE', category: 'Multimedia', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: 'CONT MULMED', minStock: 1 },
            { id: 'MM0012', name: 'AUDIO CONVERTER', category: 'Multimedia', stock: 3, unit: 'pcs', location: 'Gudang Utama', rack: 'CONT MULMED', minStock: 1 },
            { id: 'MM0013', name: 'UGREEN ALL IN ONE DATA CABLE SET', category: 'Multimedia', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: 'CONT MULMED', minStock: 1 },
            { id: 'MM0014', name: 'SANDISK 128GB', category: 'Multimedia', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: 'CONT MULMED', minStock: 1 },
            { id: 'MM0015', name: 'USB 4GB', category: 'Multimedia', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: 'CONT MULMED', minStock: 1 },
            { id: 'MM0016', name: 'DONGLE HDMI', category: 'Multimedia', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: 'CONT MULMED', minStock: 1 },
            { id: 'MM0017', name: 'KABEL HDMI 25M BAFO', category: 'Multimedia', stock: 3, unit: 'pcs', location: 'Gudang Utama', rack: 'CONT HDMI', minStock: 1 },
            { id: 'MM0018', name: 'KABEL HDMI 3M VENTION', category: 'Multimedia', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: 'CONT HDMI', minStock: 1 },
            { id: 'MM0019', name: 'KABEL HDMI 1M VENTION', category: 'Multimedia', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: 'CONT HDMI', minStock: 1 },
            { id: 'MM0020', name: 'SPLITTER HDMI 4PORT', category: 'Multimedia', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: 'CONT HDMI', minStock: 1 },
            { id: 'MM0021', name: 'EXTENDER HDMI TO LAN', category: 'Multimedia', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: 'CONT HDMI', minStock: 1 },
            { id: 'MM0022', name: 'USB EXTENTION 5M BIRU', category: 'Multimedia', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: 'CONT HDMI', minStock: 1 },
            { id: 'MM0023', name: 'USB EXTENTION 10M BIRU', category: 'Multimedia', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: 'CONT HDMI', minStock: 1 },
            { id: 'MM0024', name: 'USB EXTENTION 10M GREY', category: 'Multimedia', stock: 1, unit: 'pcs', location: 'Gudang Utama', rack: 'CONT HDMI', minStock: 1 },
            { id: 'MM0025', name: 'WEB CAM MTECH', category: 'Multimedia', stock: 2, unit: 'pcs', location: 'Gudang Utama', rack: 'CONT MULMED', minStock: 1 }
];
// Membangun struktur database awal (default users + data barang impor + modul lain kosong),
// dipakai saat aplikasi pertama kali dijalankan di sebuah device (localStorage masih kosong).
function seedDB() {
    return {
        users: [
            { id: 'u-staff', username: 'staff', password: 'staff123', name: 'Budi Santoso', role: 'staff' },
            { id: 'u-admin', username: 'admin', password: 'admin123', name: 'Sari Wijaya', role: 'admin' },
            { id: 'u-mgr', username: 'manajemen', password: 'manajemen123', name: 'Hendra Kusuma', role: 'manajemen' }
        ],
        items: JSON.parse(JSON.stringify(IMPORTED_ITEMS)),
        loans: [],
        damages: [],
        purchases: [],
        requests: [],
        lost: [],
        consumables: [],
        itemsDataVersion: ITEMS_DATA_VERSION
    };
}
// Membaca database dari localStorage. Jika belum ada, buat dari seedDB(). Jika versi data barang
// berbeda dari ITEMS_DATA_VERSION, migrasikan daftar barang ke data terbaru tanpa menghapus riwayat lain.
function getDB() {
    let raw = localStorage.getItem(DB_KEY);
    if (!raw) {
        const seeded = seedDB();
        localStorage.setItem(DB_KEY, JSON.stringify(seeded));
        return seeded;
    }
    let db;
    try { db = JSON.parse(raw); } catch (e) { const seeded = seedDB(); localStorage.setItem(DB_KEY, JSON.stringify(seeded)); return seeded; }
    // Migrasi data lama yang belum punya modul Barang Habis Pakai/ATK.
    if (!db.consumables) db.consumables = [];
    // Migrasi: perbarui daftar barang ke data import terbaru jika versi berbeda,
    // tanpa menghapus riwayat peminjaman/pembelian/dll yang sudah ada.
    if (db.itemsDataVersion !== ITEMS_DATA_VERSION) {
        db.items = JSON.parse(JSON.stringify(IMPORTED_ITEMS));
        db.itemsDataVersion = ITEMS_DATA_VERSION;
        localStorage.setItem(DB_KEY, JSON.stringify(db));
    }
    return db;
}
// Menyimpan objek database ke localStorage. Mengembalikan false + toast jika penyimpanan gagal (penuh).
function saveDB(db) {
    try {
        localStorage.setItem(DB_KEY, JSON.stringify(db));
        return true;
    } catch (e) {
        toast('Penyimpanan penuh (foto invoice terlalu besar/banyak). Data terakhir gagal disimpan.', 'danger');
        return false;
    }
}

/* ---------- Session ---------- */
function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { return null; }
}
// Menyimpan data sesi pengguna yang berhasil login ke localStorage.
function setSession(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id: user.id, username: user.username, name: user.name, role: user.role }));
}
// Menghapus sesi login (dipakai saat logout).
function clearSession() { localStorage.removeItem(SESSION_KEY); }
// Alias singkat untuk mengambil data pengguna yang sedang login.
function currentUser() { return getSession(); }
// Mengecek apakah role pengguna yang sedang login termasuk salah satu dari role yang diberikan.
function hasRole(...roles) {
    const u = currentUser();
    return u && roles.includes(u.role);
}

/* ---------- Toast ---------- */
function toast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    const icon = type === 'success' ? 'check-circle' : type === 'danger' ? 'x-circle' : 'alert-triangle';
    el.innerHTML = `<i data-lucide="${icon}"></i><span>${escapeHtml(msg)}</span>`;
    container.appendChild(el);
    if (window.lucide) lucide.createIcons();
    setTimeout(() => { el.remove(); }, 3800);
}

/* ---------- Modal ---------- */
function openModal(title, bodyHtml) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal').classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}
// Menutup modal dan mengosongkan isinya.
function closeModal() {
    document.getElementById('modal').classList.add('hidden');
    document.getElementById('modal-body').innerHTML = '';
}

/* ---------- Navigasi (menu per role) ----------
   Setiap item menu mendefinisikan role apa saja yang boleh melihatnya,
   sehingga sidebar otomatis menyesuaikan isi menu berdasarkan role
   pengguna yang sedang login (staff/admin/manajemen). */
const NAV_CONFIG = [
    { section: 'Umum', items: [
        { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard', roles: ['staff', 'admin', 'manajemen'] },
        { id: 'items', label: 'Data Barang', icon: 'package', roles: ['staff', 'admin', 'manajemen'] },
        { id: 'loans', label: 'Peminjaman', icon: 'arrow-up-right', roles: ['staff', 'admin', 'manajemen'] },
        { id: 'returns', label: 'Pengembalian', icon: 'corner-down-left', roles: ['staff', 'admin', 'manajemen'] },
        { id: 'requests', label: 'Pengajuan Pembelian', icon: 'file-text', roles: ['staff', 'admin', 'manajemen'] }
    ]},
    { section: 'Gudang (Admin)', items: [
        { id: 'purchases', label: 'Pembelian Barang', icon: 'shopping-cart', roles: ['admin', 'manajemen'] },
        { id: 'damages', label: 'Barang Rusak / MT', icon: 'wrench', roles: ['admin', 'manajemen'] },
        { id: 'lost', label: 'Barang Hilang', icon: 'search-x', roles: ['admin', 'manajemen'] },
        { id: 'consumables', label: 'Barang Habis Pakai / ATK', icon: 'package-minus', roles: ['staff', 'admin', 'manajemen'] }
    ]},
    { section: 'Manajemen', items: [
        { id: 'users', label: 'Manajemen User', icon: 'users', roles: ['manajemen'] }
    ]}
];
// Judul yang ditampilkan di topbar untuk masing-masing halaman (pageId).
const PAGE_TITLES = {
    dashboard: 'Dashboard', items: 'Data Barang', loans: 'Peminjaman',
    returns: 'Pengembalian', purchases: 'Pembelian Barang Baru', requests: 'Pengajuan Pembelian',
    damages: 'Barang Rusak / Maintenance', lost: 'Barang Hilang', users: 'Manajemen User',
    consumables: 'Barang Habis Pakai / ATK'
};
let currentPage = 'dashboard'; // menyimpan halaman yang sedang aktif ditampilkan

// Menghitung jumlah aksi PEMINJAMAN (pengajuan pinjam baru) yang butuh perhatian user saat ini,
// untuk badge menu "Peminjaman": admin -> jumlah pengajuan menunggu persetujuannya;
// staff -> jumlah pengajuannya sendiri yang masih menunggu admin; manajemen tidak terlibat di sini.
function loanActionCount() {
    const db = getDB();
    const u = currentUser();
    if (!u) return 0;
    if (u.role === 'admin') return db.loans.filter(l => l.status === 'menunggu_admin').length;
    if (u.role === 'manajemen') return 0;
    return db.loans.filter(l => l.requestedBy === u.name && l.status === 'menunggu_admin').length;
}
// Menghitung jumlah aksi PENGEMBALIAN yang butuh perhatian user saat ini, untuk badge menu
// "Pengembalian": admin -> pengajuan pengembalian yang menunggu tahap Admin; manajemen -> yang
// sudah lolos tahap Admin dan menunggu keputusan akhir Manajemen; staff -> pengajuan pengembalian
// miliknya sendiri yang masih dalam proses (tahap Admin atau Manajemen).
function returnActionCount() {
    const db = getDB();
    const u = currentUser();
    if (!u) return 0;
    if (u.role === 'admin') return db.loans.filter(l => l.status === 'menunggu_admin_pengembalian').length;
    if (u.role === 'manajemen') return db.loans.filter(l => l.status === 'menunggu_manajemen_pengembalian').length;
    return db.loans.filter(l => l.returnSubmittedBy === u.name && (l.status === 'menunggu_admin_pengembalian' || l.status === 'menunggu_manajemen_pengembalian')).length;
}
// Membangun dan merender menu sidebar sesuai role pengguna, termasuk badge jumlah pengajuan/peminjaman
// yang masih menunggu diproses.
function renderSidebar() {
    const nav = document.getElementById('sidebar-nav');
    const db = getDB();
    const pendingReq = db.requests.filter(r => r.status === 'pending').length;
    let html = '';
    NAV_CONFIG.forEach(sec => {
        const visible = sec.items.filter(it => it.roles.includes(currentUser().role));
        if (!visible.length) return;
        html += `<div class="nav-section-label">${escapeHtml(sec.section)}</div>`;
        visible.forEach(it => {
            let badge = '';
            if (it.id === 'requests' && hasRole('admin', 'manajemen') && pendingReq > 0) badge = `<span class="nav-badge">${pendingReq}</span>`;
            if (it.id === 'loans') {
                const n = loanActionCount();
                if (n > 0) badge = `<span class="nav-badge">${n}</span>`;
            }
            if (it.id === 'returns') {
                const n = returnActionCount();
                if (n > 0) badge = `<span class="nav-badge">${n}</span>`;
            }
            html += `<div class="nav-item ${currentPage === it.id ? 'active' : ''}" onclick="navigateTo('${it.id}')">
                <i data-lucide="${it.icon}"></i><span>${escapeHtml(it.label)}</span>${badge}
            </div>`;
        });
    });
    nav.innerHTML = html;
    if (window.lucide) lucide.createIcons();
}
// Berpindah ke halaman lain: memperbarui state halaman aktif, judul, sidebar, lalu merender kontennya.
function navigateTo(pageId) {
    currentPage = pageId;
    document.getElementById('page-title').textContent = PAGE_TITLES[pageId] || '';
    document.getElementById('sidebar').classList.remove('open');
    renderSidebar();
    renderPage(pageId);
}
// Merender konten halaman sesuai pageId ke dalam area konten, lalu menjalankan hook setelah-render (jika ada).
function renderPage(pageId) {
    const map = {
        dashboard: renderDashboard, items: renderItemsPage, loans: renderLoansPage, returns: renderReturnsPage,
        purchases: renderPurchasesPage, requests: renderRequestsPage, damages: renderDamagesPage,
        lost: renderLostPage, users: renderUsersPage, consumables: renderConsumablesPage
    };
    const fn = map[pageId] || renderDashboard;
    document.getElementById('content-area').innerHTML = fn();
    if (window.lucide) lucide.createIcons();
    afterRenderHooks[pageId] && afterRenderHooks[pageId]();
}
// Kode tambahan yang dijalankan setelah HTML suatu halaman selesai dirender,
// misalnya untuk inisialisasi elemen dinamis yang tidak bisa dilakukan lewat HTML string biasa.
const afterRenderHooks = {
    loans: function () {
        // Saat tab "Peminjaman Event" pertama kali dibuka, otomatis tambahkan satu baris barang kosong.
        if (loanTab === 'event') {
            const wrap = document.getElementById('event-items-wrap');
            if (wrap && !wrap.children.length) addEventItemRow();
        }
    }
};

/* =========================================================
   DASHBOARD
   ========================================================= */
function renderDashboard() {
    const db = getDB();
    const totalItems = db.items.length;
    const lowStock = db.items.filter(i => i.stock <= i.minStock).length;
    const activeLoans = db.loans.filter(l => l.status === 'dipinjam').length;
    const pendingReq = db.requests.filter(r => r.status === 'pending').length;

    const recent = [
        ...db.loans.map(l => ({ date: l.borrowDate, text: `${l.borrower} meminjam ${l.itemName} (${l.qty})`, icon: 'repeat' })),
        ...db.purchases.map(p => ({ date: p.date, text: `Pembelian baru: ${p.itemName} (${p.qty})`, icon: 'shopping-cart' })),
        ...db.damages.map(d => ({ date: d.date, text: `${d.type === 'mt' ? 'Perlu maintenance' : 'Barang rusak'}: ${d.itemName}`, icon: 'wrench' })),
        ...db.requests.map(r => ({ date: r.date, text: `Pengajuan pembelian: ${r.itemName} oleh ${r.requestedBy}`, icon: 'file-text' })),
        ...db.lost.map(l => ({ date: l.date, text: `Barang hilang dilaporkan: ${l.itemName}`, icon: 'search-x' }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);

    return `
    <div class="card-grid">
        <div class="stat-card">
            <div class="stat-icon"><i data-lucide="package"></i></div>
            <div><div class="stat-value">${totalItems}</div><div class="stat-label">Jenis Barang</div></div>
        </div>
        <div class="stat-card">
            <div class="stat-icon warning"><i data-lucide="alert-triangle"></i></div>
            <div><div class="stat-value">${lowStock}</div><div class="stat-label">Stok Menipis</div></div>
        </div>
        <div class="stat-card">
            <div class="stat-icon success"><i data-lucide="repeat"></i></div>
            <div><div class="stat-value">${activeLoans}</div><div class="stat-label">Sedang Dipinjam</div></div>
        </div>
        <div class="stat-card">
            <div class="stat-icon purple"><i data-lucide="file-text"></i></div>
            <div><div class="stat-value">${pendingReq}</div><div class="stat-label">Pengajuan Menunggu</div></div>
        </div>
    </div>
    <div class="table-container">
        <div class="table-header"><h3>Aktivitas Terbaru</h3></div>
        <table class="data-table">
            <thead><tr><th>Tanggal</th><th>Aktivitas</th></tr></thead>
            <tbody>
                ${recent.length ? recent.map(r => `<tr><td>${fmtDate(r.date)}</td><td>${escapeHtml(r.text)}</td></tr>`).join('') : '<tr class="empty-row"><td colspan="2">Belum ada aktivitas.</td></tr>'}
            </tbody>
        </table>
    </div>`;
}

/* =========================================================
   DATA BARANG (lokasi & rak terpisah)
   ========================================================= */
function renderItemsPage() {
    const db = getDB();
    const canEdit = hasRole('admin', 'manajemen');
    return `
    <div class="page-header">
        <div><p>Kelola data barang, stok, lokasi, dan rak penyimpanan.</p></div>
        ${canEdit ? `<button class="btn btn-primary" onclick="openItemForm()"><i data-lucide="plus"></i>Tambah Barang</button>` : ''}
    </div>
    <div class="filter-bar">
        <input type="text" id="item-search" placeholder="Cari nama barang..." oninput="filterItemsTable()">
    </div>
    <div class="table-container">
        <table class="data-table">
            <thead><tr>
                <th>Nama Barang</th><th>Kategori</th><th>Stok</th><th>Satuan</th><th>Lokasi</th><th>Rak</th><th>Status</th>${canEdit ? '<th>Aksi</th>' : ''}
            </tr></thead>
            <tbody id="items-tbody">
                ${itemsTableRows(db.items, canEdit)}
            </tbody>
        </table>
    </div>`;
}
// Merender baris-baris tabel data barang, menampilkan badge 'Stok Menipis' dan tombol edit/hapus jika diizinkan.
function itemsTableRows(items, canEdit) {
    if (!items.length) return `<tr class="empty-row"><td colspan="8">Belum ada data barang.</td></tr>`;
    return items.map(it => {
        const low = it.stock <= it.minStock;
        const tags = [];
        if (it.electronicType === 'alat_kerja') tags.push(`<span class="badge badge-info">Elektronik: Alat Kerja${it.electronicCode ? ' &middot; ' + escapeHtml(it.electronicCode) : ''}</span>`);
        if (it.electronicType === 'alat_lain') tags.push(`<span class="badge badge-info">Elektronik: Alat Lain${it.electronicCode ? ' &middot; ' + escapeHtml(it.electronicCode) : ''}</span>`);
        if (it.isConsumable) tags.push('<span class="badge badge-warning">ATK/Habis Pakai</span>');
        let stockBadge;
        if (it.isConsumable && it.stock <= 0) stockBadge = '<span class="badge badge-danger">Habis Terpakai</span>';
        else if (low) stockBadge = '<span class="badge badge-danger">Stok Menipis</span>';
        else stockBadge = '<span class="badge badge-success">Aman</span>';
        return `<tr>
            <td>${escapeHtml(it.name)}</td>
            <td>${escapeHtml(it.category || '-')}${tags.length ? '<br>' + tags.join(' ') : ''}</td>
            <td>${it.stock}</td>
            <td>${escapeHtml(it.unit || '-')}</td>
            <td>${escapeHtml(it.location || '-')}</td>
            <td>${escapeHtml(it.rack || '-')}</td>
            <td>${stockBadge}</td>
            ${canEdit ? `<td class="actions">
                <button class="btn-icon" title="Edit" onclick="openItemForm('${it.id}')"><i data-lucide="pencil"></i></button>
                <button class="btn-icon text-danger" title="Hapus" onclick="deleteItem('${it.id}')"><i data-lucide="trash-2"></i></button>
            </td>` : ''}
        </tr>`;
    }).join('');
}
// Memfilter tabel data barang secara langsung berdasarkan kata kunci pencarian nama barang.
function filterItemsTable() {
    const q = document.getElementById('item-search').value.toLowerCase();
    const db = getDB();
    const filtered = db.items.filter(i => i.name.toLowerCase().includes(q));
    document.getElementById('items-tbody').innerHTML = itemsTableRows(filtered, hasRole('admin', 'manajemen'));
    if (window.lucide) lucide.createIcons();
}
// Membuka form tambah/edit barang. Jika itemId diisi, form akan terisi data barang yang sudah ada.
function openItemForm(itemId) {
    const db = getDB();
    const item = itemId ? db.items.find(i => i.id === itemId) : null;
    openModal(item ? 'Edit Barang' : 'Tambah Barang Baru', `
        <form id="item-form" onsubmit="submitItemForm(event, '${itemId || ''}')">
            <div class="form-group"><label>Nama Barang</label><input type="text" id="f-name" value="${item ? escapeHtml(item.name) : ''}" required></div>
            <div class="form-row">
                <div class="form-group"><label>Kategori</label><input type="text" id="f-category" value="${item ? escapeHtml(item.category || '') : ''}"></div>
                <div class="form-group"><label>Satuan</label><input type="text" id="f-unit" placeholder="pcs / unit / roll" value="${item ? escapeHtml(item.unit || '') : ''}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Stok Saat Ini</label><input type="number" id="f-stock" min="0" value="${item ? item.stock : 0}" required></div>
                <div class="form-group"><label>Stok Minimum</label><input type="number" id="f-minstock" min="0" value="${item ? item.minStock : 1}" required></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Lokasi (Gudang)</label><input type="text" id="f-location" placeholder="cth: Gudang A" value="${item ? escapeHtml(item.location || '') : ''}" required></div>
                <div class="form-group"><label>Rak</label><input type="text" id="f-rack" placeholder="cth: Rak 2-B" value="${item ? escapeHtml(item.rack || '') : ''}" required></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Tipe Elektronik (khusus kategori Elektronik)</label>
                    <select id="f-electype" onchange="toggleElecCodeField()">
                        <option value="" ${!item || !item.electronicType ? 'selected' : ''}>- Bukan Elektronik / Tidak Berlaku -</option>
                        <option value="alat_kerja" ${item && item.electronicType === 'alat_kerja' ? 'selected' : ''}>Alat Kerja (kode khusus)</option>
                        <option value="alat_lain" ${item && item.electronicType === 'alat_lain' ? 'selected' : ''}>Alat Lain (kode khusus)</option>
                    </select>
                </div>
                <div class="form-group" id="f-eleccode-wrap" style="${item && item.electronicType ? '' : 'display:none;'}">
                    <label>Kode Khusus Elektronik</label>
                    <div style="display:flex;gap:6px;">
                        <input type="text" id="f-eleccode" placeholder="cth: AK-001" value="${item ? escapeHtml(item.electronicCode || '') : ''}" style="flex:1;">
                        <button type="button" class="btn btn-secondary btn-sm" onclick="generateElecCode()">Generate</button>
                    </div>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label><input type="checkbox" id="f-consumable" ${item && item.isConsumable ? 'checked' : ''}> Barang Habis Pakai / ATK</label>
                    <p class="text-muted" style="margin-top:4px;">Aktifkan untuk barang seperti lakban, dll. yang bisa dilaporkan "Habis Pakai" dan berpotensi berstatus "Habis Terpakai".</p>
                </div>
            </div>
            <button type="submit" class="btn btn-primary btn-block">Simpan</button>
        </form>
    `);
}
// Menampilkan/menyembunyikan field kode khusus elektronik sesuai tipe elektronik yang dipilih.
function toggleElecCodeField() {
    const val = document.getElementById('f-electype').value;
    document.getElementById('f-eleccode-wrap').style.display = val ? '' : 'none';
}
// Membuatkan kode khusus otomatis (AK-xxx untuk Alat Kerja, AL-xxx untuk Alat Lain) berdasarkan
// jumlah barang elektronik bertipe sama yang sudah ada, lalu mengisikannya ke field kode.
function generateElecCode() {
    const type = document.getElementById('f-electype').value;
    if (!type) { toast('Pilih tipe elektronik dahulu.', 'warning'); return; }
    const db = getDB();
    const prefix = type === 'alat_kerja' ? 'AK' : 'AL';
    const count = db.items.filter(i => i.electronicType === type).length + 1;
    document.getElementById('f-eleccode').value = `${prefix}-${String(count).padStart(3, '0')}`;
}
// Menyimpan data barang baru atau hasil edit barang yang sudah ada ke database.
function submitItemForm(e, itemId) {
    e.preventDefault();
    const db = getDB();
    const data = {
        name: document.getElementById('f-name').value.trim(),
        category: document.getElementById('f-category').value.trim(),
        unit: document.getElementById('f-unit').value.trim(),
        stock: Number(document.getElementById('f-stock').value),
        minStock: Number(document.getElementById('f-minstock').value),
        location: document.getElementById('f-location').value.trim(),
        rack: document.getElementById('f-rack').value.trim(),
        electronicType: document.getElementById('f-electype').value,
        electronicCode: document.getElementById('f-eleccode').value.trim(),
        isConsumable: document.getElementById('f-consumable').checked
    };
    if (itemId) {
        const idx = db.items.findIndex(i => i.id === itemId);
        db.items[idx] = { ...db.items[idx], ...data };
        toast('Barang berhasil diperbarui.');
    } else {
        db.items.push({ id: uid('itm'), ...data });
        toast('Barang baru berhasil ditambahkan.');
    }
    saveDB(db);
    closeModal();
    renderPage('items');
    renderSidebar();
}
// Menghapus data barang setelah konfirmasi pengguna.
function deleteItem(itemId) {
    if (!confirm('Hapus barang ini? Tindakan tidak dapat dibatalkan.')) return;
    const db = getDB();
    db.items = db.items.filter(i => i.id !== itemId);
    saveDB(db);
    renderPage('items');
    toast('Barang dihapus.', 'warning');
}

/* =========================================================
   PEMINJAMAN & PENGEMBALIAN (+ form Barang Rusak/MT khusus admin)
   ========================================================= */
let loanTab = 'pinjam'; // tab yang sedang aktif di halaman Peminjaman & Pengembalian
// Membangun kerangka halaman Peminjaman & Pengembalian (tab-tab) beserta konten tab yang sedang aktif.
function renderLoansPage() {
    const db = getDB();
    const approvalCount = db.loans.filter(l => l.status === 'menunggu_admin').length;
    return `
    <div class="tabs">
        <button class="tab-btn ${loanTab === 'pinjam' ? 'active' : ''}" onclick="switchLoanTab('pinjam')">Ajukan Peminjaman</button>
        <button class="tab-btn ${loanTab === 'event' ? 'active' : ''}" onclick="switchLoanTab('event')">Peminjaman Event</button>
        <button class="tab-btn ${loanTab === 'persetujuan' ? 'active' : ''}" onclick="switchLoanTab('persetujuan')">Menunggu Persetujuan${approvalCount ? ` (${approvalCount})` : ''}</button>
        <button class="tab-btn ${loanTab === 'aktif' ? 'active' : ''}" onclick="switchLoanTab('aktif')">Sedang Dipinjam</button>
        <button class="tab-btn ${loanTab === 'riwayat' ? 'active' : ''}" onclick="switchLoanTab('riwayat')">Riwayat</button>
    </div>
    <div id="loans-tab-content">${renderLoanTabContent()}</div>`;
}
/* ---------- Halaman Pengembalian (terpisah dari Peminjaman) ---------- */
let returnTab = 'persetujuan'; // tab yang sedang aktif di halaman Pengembalian
function switchReturnTab(tab) { returnTab = tab; renderPage('returns'); }
function renderReturnsPage() {
    const db = getDB();
    const adminCount = db.loans.filter(l => l.status === 'menunggu_admin_pengembalian').length;
    const manajemenCount = db.loans.filter(l => l.status === 'menunggu_manajemen_pengembalian').length;
    return `
    <div class="tabs">
        <button class="tab-btn ${returnTab === 'persetujuan' ? 'active' : ''}" onclick="switchReturnTab('persetujuan')">Menunggu Persetujuan${(adminCount + manajemenCount) ? ` (${adminCount + manajemenCount})` : ''}</button>
        <button class="tab-btn ${returnTab === 'riwayat' ? 'active' : ''}" onclick="switchReturnTab('riwayat')">Riwayat Pengembalian</button>
    </div>
    <div id="returns-tab-content">${renderReturnTabContent()}</div>`;
}
// Merender konten tab halaman Pengembalian (persetujuan bertingkat Admin -> Manajemen, atau riwayat).
function renderReturnTabContent() {
    const db = getDB();
    if (returnTab === 'persetujuan') {
        // Tahap 1: menunggu Admin memeriksa pengajuan pengembalian (semua kondisi masuk sini dulu).
        let returnAdminList = db.loans.filter(l => l.status === 'menunggu_admin_pengembalian');
        // Tahap 2: sudah lolos Admin, menunggu keputusan akhir Manajemen (hanya kondisi bermasalah).
        let returnList = db.loans.filter(l => l.status === 'menunggu_manajemen_pengembalian');
        const u = currentUser();
        if (u.role === 'staff') {
            returnAdminList = returnAdminList.filter(l => l.returnSubmittedBy === u.name);
            returnList = returnList.filter(l => l.returnSubmittedBy === u.name);
        }
        returnAdminList = returnAdminList.sort((a, b) => new Date(b.returnSubmittedDate) - new Date(a.returnSubmittedDate));
        returnList = returnList.sort((a, b) => new Date(b.returnSubmittedDate) - new Date(a.returnSubmittedDate));

        const { groups: returnAdminGroups, singles: returnAdminSingles } = groupLoansByEvent(returnAdminList);
        const returnAdminRows = returnAdminSingles.map(l => `<tr>
            <td><span class="badge badge-purple">Tahap Admin</span></td>
            <td>${escapeHtml(l.itemId)}</td><td>${escapeHtml(l.itemName)}</td><td>${l.qty}</td><td>${escapeHtml(l.borrower)}</td>
            <td>Diproses oleh ${escapeHtml(l.returnSubmittedBy)}<div style="margin-top:4px;">${pendingConditionCell(l)}</div></td><td>${fmtDate(l.returnSubmittedDate)}</td>
            <td class="actions">
                <button class="btn btn-sm btn-secondary" onclick="viewKendalaDetail('${l.id}')"><i data-lucide="eye"></i>Detail</button>
                ${hasRole('admin') ? `
                    <button class="btn btn-sm btn-success" onclick="approveReturnAdmin('${l.id}')"><i data-lucide="check"></i>Setujui</button>
                    <button class="btn btn-sm btn-danger" onclick="rejectReturnAdmin('${l.id}')"><i data-lucide="x"></i>Tolak</button>
                ` : '<span class="text-muted">Menunggu proses Admin</span>'}
            </td>
        </tr>`).join('') + Object.keys(returnAdminGroups).map(eventId => {
            const items = returnAdminGroups[eventId];
            const first = items[0];
            const itemsSummary = items.map(l => `${escapeHtml(l.itemName)} (${l.qty}) &middot; ${pendingConditionCell(l)} <button class="btn btn-sm btn-secondary" onclick="viewKendalaDetail('${l.id}')"><i data-lucide="eye"></i>Detail</button>`).join('<br>');
            return `<tr>
                <td><span class="badge badge-purple">Event &middot; Tahap Admin</span></td>
                <td colspan="3"><strong>${escapeHtml(first.eventName)}</strong><br><span class="text-muted">${itemsSummary}</span></td>
                <td>${escapeHtml(first.borrower)}</td>
                <td>Diproses oleh ${escapeHtml(first.returnSubmittedBy)}</td><td>${fmtDate(first.returnSubmittedDate)}</td>
                <td class="actions">
                    ${hasRole('admin') ? `
                        <button class="btn btn-sm btn-success" onclick="approveEventReturnAdmin('${eventId}')"><i data-lucide="check"></i>Setujui Semua</button>
                        <button class="btn btn-sm btn-danger" onclick="rejectEventReturnAdmin('${eventId}')"><i data-lucide="x"></i>Tolak Semua</button>
                    ` : '<span class="text-muted">Menunggu proses Admin</span>'}
                </td>
            </tr>`;
        }).join('');

        const { groups: returnGroups, singles: returnSingles } = groupLoansByEvent(returnList);
        const returnRows = returnSingles.map(l => `<tr>
            <td><span class="badge badge-purple">Tahap Manajemen</span></td>
            <td>${escapeHtml(l.itemId)}</td><td>${escapeHtml(l.itemName)}</td><td>${l.qty}</td><td>${escapeHtml(l.borrower)}</td>
            <td>Diproses oleh ${escapeHtml(l.returnSubmittedBy)}<div style="margin-top:4px;">${pendingConditionCell(l)}</div></td><td>${fmtDate(l.returnSubmittedDate)}</td>
            <td class="actions">
                <button class="btn btn-sm btn-secondary" onclick="viewKendalaDetail('${l.id}')"><i data-lucide="eye"></i>Detail</button>
                ${hasRole('manajemen') ? `
                    <button class="btn btn-sm btn-success" onclick="approveReturnManajemen('${l.id}')"><i data-lucide="check"></i>Setujui</button>
                    <button class="btn btn-sm btn-danger" onclick="rejectReturnManajemen('${l.id}')"><i data-lucide="x"></i>Tolak</button>
                ` : '<span class="text-muted">Menunggu proses Manajemen</span>'}
            </td>
        </tr>`).join('') + Object.keys(returnGroups).map(eventId => {
            const items = returnGroups[eventId];
            const first = items[0];
            const itemsSummary = items.map(l => `${escapeHtml(l.itemName)} (${l.qty}) &middot; ${pendingConditionCell(l)} <button class="btn btn-sm btn-secondary" onclick="viewKendalaDetail('${l.id}')"><i data-lucide="eye"></i>Detail</button>`).join('<br>');
            return `<tr>
                <td><span class="badge badge-purple">Event &middot; Tahap Manajemen</span></td>
                <td colspan="3"><strong>${escapeHtml(first.eventName)}</strong><br><span class="text-muted">${itemsSummary}</span></td>
                <td>${escapeHtml(first.borrower)}</td>
                <td>Diproses oleh ${escapeHtml(first.returnSubmittedBy)}</td><td>${fmtDate(first.returnSubmittedDate)}</td>
                <td class="actions">
                    ${hasRole('manajemen') ? `
                        <button class="btn btn-sm btn-success" onclick="approveEventReturnManajemen('${eventId}')"><i data-lucide="check"></i>Setujui Semua</button>
                        <button class="btn btn-sm btn-danger" onclick="rejectEventReturnManajemen('${eventId}')"><i data-lucide="x"></i>Tolak Semua</button>
                    ` : '<span class="text-muted">Menunggu proses Manajemen</span>'}
                </td>
            </tr>`;
        }).join('');

        const rows = returnAdminRows + returnRows;
        return `
        <div class="table-container">
            <table class="data-table">
                <thead><tr><th>Tahap</th><th>ID Barang</th><th>Barang</th><th>Jml</th><th>Peminjam</th><th>Keterangan</th><th>Tanggal</th><th>Aksi</th></tr></thead>
                <tbody>
                    ${rows || `<tr class="empty-row"><td colspan="8">Tidak ada pengajuan pengembalian yang menunggu persetujuan.</td></tr>`}
                </tbody>
            </table>
        </div>`;
    }
    // riwayat pengembalian: hanya peminjaman yang sudah tuntas dikembalikan (final, disetujui).
    const done = db.loans.filter(l => l.status === 'dikembalikan')
        .sort((a, b) => new Date(b.returnDate) - new Date(a.returnDate));
    return `
    <div class="table-container">
        <table class="data-table">
            <thead><tr><th>ID Barang</th><th>Barang</th><th>Jml</th><th>Peminjam</th><th>Tgl Kembali</th><th>Kondisi</th><th>Kronologi/Catatan</th><th>Diproses Oleh</th><th>Disetujui Oleh</th></tr></thead>
            <tbody>
                ${done.length ? done.map(l => `<tr>
                    <td>${escapeHtml(l.itemId)}</td><td>${escapeHtml(l.itemName)}</td><td>${l.qty}</td>
                    <td>${escapeHtml(l.borrower)}${l.eventName ? `<br><span class="badge badge-purple" style="margin-top:4px;">Event: ${escapeHtml(l.eventName)}</span>` : ''}</td>
                    <td>${fmtDate(l.returnDate)}</td>
                    <td>${historyConditionCell(l)}${Array.isArray(l.issues) && l.issues.length ? `<br><button class="btn btn-sm btn-secondary" style="margin-top:4px;" onclick="viewKendalaDetail('${l.id}')"><i data-lucide="eye"></i>Detail</button>` : ''}</td>
                    <td>${escapeHtml(l.returnNotes || '-')}</td>
                    <td>${escapeHtml(l.processedBy || '-')}</td>
                    <td>${escapeHtml(l.returnApprovedBy || '-')}</td>
                </tr>`).join('') : `<tr class="empty-row"><td colspan="9">Belum ada riwayat pengembalian.</td></tr>`}
            </tbody>
        </table>
    </div>`;
}
// Mengganti tab aktif pada halaman Peminjaman lalu merender ulang halamannya.
function switchLoanTab(tab) { loanTab = tab; renderPage('loans'); }
// Merender konten sesuai tab peminjaman yang aktif saat ini (pinjam/event/persetujuan/aktif/riwayat).
function renderLoanTabContent() {
    const db = getDB();
    if (loanTab === 'pinjam') {
        const options = db.items.filter(i => i.stock > 0);
        loanItemPickCache = options; // simpan untuk dipakai fungsi pencarian
        return `
        <div class="table-container">
            <div class="modal-body">
                <form id="loan-form" onsubmit="submitLoanForm(event)">
                    <div class="form-group"><label>Pilih Barang</label>
                        <div class="ev-item-search-wrap">
                            <input type="text" id="loan-item-search" placeholder="${options.length ? 'Cari nama atau ID barang...' : 'Tidak ada barang tersedia'}" autocomplete="off" ${options.length ? '' : 'disabled'}
                                oninput="onLoanItemSearchInput()" onfocus="onLoanItemSearchInput()" onblur="hideLoanItemDropdownDelayed()">
                            <input type="hidden" id="loan-item" value="">
                            <div class="ev-item-dropdown hidden" id="loan-item-dropdown"></div>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label>Jumlah</label><input type="number" id="loan-qty" min="1" value="1" required></div>
                        <div class="form-group"><label>Nama User / PIC Peminjaman (penanggung jawab)</label><input type="text" id="loan-borrower" value="${escapeHtml(currentUser().name)}" required></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label>Tanggal Pinjam</label><input type="date" id="loan-date" value="${todayStr()}" required></div>
                        <div class="form-group"><label>Rencana Kembali</label><input type="date" id="loan-return-plan" required></div>
                    </div>
                    <div class="form-group"><label>Keperluan / Catatan</label><textarea id="loan-notes" placeholder="cth: untuk perbaikan mesin di lokasi X"></textarea></div>
                    <p class="text-muted" style="margin-bottom:12px;">Pengajuan ini akan diproses menunggu persetujuan Admin sebelum barang boleh diambil.</p>
                    <button type="submit" class="btn btn-primary">Ajukan Peminjaman</button>
                </form>
            </div>
        </div>`;
    }
    if (loanTab === 'event') {
        return renderEventLoanForm();
    }
    if (loanTab === 'persetujuan') {
        // Tab ini HANYA berisi pengajuan PEMINJAMAN baru (menunggu Admin).
        // Pengajuan PENGEMBALIAN sekarang diproses terpisah di halaman "Pengembalian".
        const u = currentUser();
        let loanList = db.loans.filter(l => l.status === 'menunggu_admin');
        if (u.role === 'staff') {
            loanList = loanList.filter(l => l.requestedBy === u.name);
        }
        loanList = loanList.sort((a, b) => new Date(b.borrowDate) - new Date(a.borrowDate));

        const { groups: loanGroups, singles: loanSingles } = groupLoansByEvent(loanList);
        const loanRows = loanSingles.map(l => `<tr>
            <td><span class="badge badge-info">Peminjaman</span></td>
            <td>${escapeHtml(l.itemId)}</td><td>${escapeHtml(l.itemName)}</td><td>${l.qty}</td><td>${escapeHtml(l.borrower)}</td>
            <td>Diajukan oleh ${escapeHtml(l.requestedBy)}</td><td>${fmtDate(l.borrowDate)}</td>
            <td class="actions">
                ${hasRole('admin') ? `
                    <button class="btn btn-sm btn-success" onclick="approveLoanStage('${l.id}','admin')"><i data-lucide="check"></i>Setujui</button>
                    <button class="btn btn-sm btn-danger" onclick="rejectLoan('${l.id}')"><i data-lucide="x"></i>Tolak</button>
                ` : '<span class="text-muted">Menunggu proses Admin</span>'}
            </td>
        </tr>`).join('') + Object.keys(loanGroups).map(eventId => {
            const items = loanGroups[eventId];
            const first = items[0];
            const itemsSummary = items.map(l => `${escapeHtml(l.itemName)} (${l.qty})`).join(', ');
            return `<tr>
                <td><span class="badge badge-purple">Event</span></td>
                <td colspan="3"><strong>${escapeHtml(first.eventName)}</strong>${first.eventLocation ? ' &middot; ' + escapeHtml(first.eventLocation) : ''}<br><span class="text-muted">${itemsSummary}</span></td>
                <td>${escapeHtml(first.borrower)}</td>
                <td>Diajukan oleh ${escapeHtml(first.requestedBy)}</td><td>${fmtDate(first.borrowDate)}</td>
                <td class="actions">
                    ${hasRole('admin') ? `
                        <button class="btn btn-sm btn-success" onclick="approveEventLoan('${eventId}')"><i data-lucide="check"></i>Setujui Semua</button>
                        <button class="btn btn-sm btn-danger" onclick="rejectEventLoan('${eventId}')"><i data-lucide="x"></i>Tolak Semua</button>
                    ` : '<span class="text-muted">Menunggu proses Admin</span>'}
                </td>
            </tr>`;
        }).join('');

        const rows = loanRows;
        return `
        <div class="table-container">
            <table class="data-table">
                <thead><tr><th>Jenis</th><th>ID Barang</th><th>Barang</th><th>Jml</th><th>Peminjam</th><th>Keterangan</th><th>Tanggal</th><th>Aksi</th></tr></thead>
                <tbody>
                    ${rows || `<tr class="empty-row"><td colspan="8">Tidak ada pengajuan peminjaman yang menunggu persetujuan.</td></tr>`}
                </tbody>
            </table>
        </div>`;
    }
    if (loanTab === 'aktif') {
        const active = db.loans.filter(l => l.status === 'dipinjam');
        const { groups: activeGroups, singles: activeSingles } = groupLoansByEvent(active);
        const singleRows = activeSingles.map(l => `<tr>
                        <td>${escapeHtml(l.itemId)}</td><td>${escapeHtml(l.itemName)}</td><td>${l.qty}</td><td>${escapeHtml(l.borrower)}</td>
                        <td>${fmtDate(l.borrowDate)}</td><td>${fmtDate(l.returnPlan)}</td>
                        <td>${escapeHtml(l.adminApprovedBy || '-')}</td>
                        <td class="actions">
                            <button class="btn btn-sm btn-secondary" onclick="printSingleLoan('${l.id}')"><i data-lucide="printer"></i>Print</button>
                            ${hasRole('admin', 'manajemen') ? `<button class="btn btn-sm btn-success" onclick="openReturnForm('${l.id}')"><i data-lucide="corner-down-left"></i>Proses Pengembalian</button>` : ''}
                        </td>
                    </tr>`).join('');
        const groupRows = Object.keys(activeGroups).map(eventId => {
            const items = activeGroups[eventId];
            const first = items[0];
            const itemsSummary = items.map(l => `${escapeHtml(l.itemName)} (${l.qty})`).join(', ');
            return `<tr>
                <td colspan="3"><span class="badge badge-purple">Event</span> <strong>${escapeHtml(first.eventName)}</strong>${first.eventLocation ? ' &middot; ' + escapeHtml(first.eventLocation) : ''}<br><span class="text-muted">${itemsSummary}</span></td>
                <td>${escapeHtml(first.borrower)}</td>
                <td>${fmtDate(first.borrowDate)}</td><td>${fmtDate(first.returnPlan)}</td>
                <td>${escapeHtml(first.adminApprovedBy || '-')}</td>
                <td class="actions">
                    <button class="btn btn-sm btn-secondary" onclick="printEventLoan('${eventId}')"><i data-lucide="printer"></i>Print</button>
                    ${hasRole('admin', 'manajemen') ? `<button class="btn btn-sm btn-success" onclick="openEventReturnForm('${eventId}')"><i data-lucide="corner-down-left"></i>Proses Pengembalian Event</button>` : ''}
                </td>
            </tr>`;
        }).join('');
        const rows = singleRows + groupRows;
        return `
        <div class="table-container">
            <table class="data-table">
                <thead><tr><th>ID Barang</th><th>Barang</th><th>Jml</th><th>Peminjam</th><th>Tgl Pinjam</th><th>Rencana Kembali</th><th>Disetujui Oleh</th><th>Aksi</th></tr></thead>
                <tbody>
                    ${rows || `<tr class="empty-row"><td colspan="8">Tidak ada peminjaman aktif.</td></tr>`}
                </tbody>
            </table>
        </div>`;
    }
    // riwayat: khusus riwayat PENGAJUAN PEMINJAMAN yang ditolak Admin (bukan barang yang sudah
    // selesai dikembalikan - itu ada di Riwayat Pengembalian pada halaman "Pengembalian").
    const done = db.loans.filter(l => l.status === 'ditolak')
        .sort((a, b) => new Date(b.rejectedDate) - new Date(a.rejectedDate));
    return `
    <p class="text-muted" style="margin-bottom:12px;">Riwayat pengajuan peminjaman yang ditolak. Riwayat barang yang sudah selesai dikembalikan ada di halaman <strong>Pengembalian</strong>.</p>
    <div class="table-container">
        <table class="data-table">
            <thead><tr><th>ID Barang</th><th>Barang</th><th>Jml</th><th>Peminjam</th><th>Tgl Pinjam</th><th>Status</th><th>Detail</th></tr></thead>
            <tbody>
                ${done.length ? done.map(l => `<tr>
                    <td>${escapeHtml(l.itemId)}</td><td>${escapeHtml(l.itemName)}</td><td>${l.qty}</td><td>${escapeHtml(l.borrower)}${l.eventName ? `<br><span class="badge badge-purple" style="margin-top:4px;">Event: ${escapeHtml(l.eventName)}</span>` : ''}</td>
                    <td>${fmtDate(l.borrowDate)}</td>
                    <td><span class="badge badge-danger">Ditolak</span></td>
                    <td>Ditolak oleh ${escapeHtml(l.rejectedBy || '-')}${l.rejectReason ? ': ' + escapeHtml(l.rejectReason) : ''}</td>
                </tr>`).join('') : `<tr class="empty-row"><td colspan="7">Belum ada riwayat penolakan peminjaman.</td></tr>`}
            </tbody>
        </table>
    </div>`;
}
// Memetakan status peminjaman menjadi label badge berwarna untuk ditampilkan di tabel.
function loanStatusBadge(status) {
    if (status === 'menunggu_admin') return '<span class="badge badge-warning">Menunggu Admin</span>';
    if (status === 'menunggu_admin_pengembalian') return '<span class="badge badge-warning">Menunggu Admin (Pengembalian)</span>';
    if (status === 'menunggu_manajemen_pengembalian') return '<span class="badge badge-purple">Menunggu Manajemen</span>';
    if (status === 'dipinjam') return '<span class="badge badge-success">Aktif</span>';
    if (status === 'ditolak') return '<span class="badge badge-danger">Ditolak</span>';
    return '-';
}
// Memetakan kondisi barang saat dikembalikan (baik/rusak/mt/hilang) menjadi label badge berwarna.
function conditionBadge(cond) {
    if (cond === 'baik') return '<span class="badge badge-success">Baik</span>';
    if (cond === 'rusak') return '<span class="badge badge-danger">Rusak</span>';
    if (cond === 'mt') return '<span class="badge badge-warning">Perlu Maintenance</span>';
    if (cond === 'hilang') return '<span class="badge badge-danger">Hilang</span>';
    if (cond === 'habis_pakai') return '<span class="badge badge-info">Habis Pakai</span>';
    if (cond === 'campuran') return '<span class="badge badge-purple">Beberapa Kendala</span>';
    return '-';
}
// Mengajukan peminjaman 1 jenis barang. Status menjadi 'menunggu_admin'; stok BELUM dikurangi
// di sini, baru dikurangi setelah disetujui Admin lewat approveLoanStage().
/* ---------- Pencarian barang (autocomplete) untuk "Pilih Barang" di form Peminjaman biasa ---------- */
let loanItemPickCache = []; // daftar barang berstok (di-set ulang tiap kali tab "pinjam" dirender)
// Menyaring daftar barang sesuai kata kunci yang diketik, lalu menampilkannya di dropdown.
function onLoanItemSearchInput() {
    const input = document.getElementById('loan-item-search');
    if (!input) return;
    const query = input.value.trim().toLowerCase();
    const filtered = query
        ? loanItemPickCache.filter(i => i.name.toLowerCase().includes(query) || i.id.toLowerCase().includes(query))
        : loanItemPickCache;
    renderLoanItemDropdown(filtered.slice(0, 50));
}
// Merender daftar dropdown saran barang (autocomplete) untuk "Pilih Barang" di form Peminjaman biasa.
function renderLoanItemDropdown(items) {
    const dropdown = document.getElementById('loan-item-dropdown');
    if (!dropdown) return;
    if (!items.length) {
        dropdown.innerHTML = `<div class="ev-item-dropdown-empty">Barang tidak ditemukan.</div>`;
    } else {
        dropdown.innerHTML = items.map(i => `
            <div class="ev-item-dropdown-item" onmousedown="event.preventDefault(); selectLoanItemFromDropdown('${i.id}')">
                <span class="ev-item-dropdown-name">${escapeHtml(i.name)}</span>
                <span class="ev-item-dropdown-meta">[${escapeHtml(i.id)}] &middot; stok: ${i.stock} ${escapeHtml(i.unit || '')}</span>
            </div>`).join('');
    }
    dropdown.classList.remove('hidden');
}
// Mengisi "Pilih Barang" dengan barang yang dipilih dari dropdown, lalu menyembunyikan dropdown.
function selectLoanItemFromDropdown(itemId) {
    const item = loanItemPickCache.find(i => i.id === itemId);
    if (!item) return;
    document.getElementById('loan-item').value = item.id;
    document.getElementById('loan-item-search').value = `[${item.id}] ${item.name} (stok: ${item.stock} ${item.unit || ''})`;
    hideLoanItemDropdown();
}
// Menyembunyikan dropdown saran barang untuk "Pilih Barang" di form Peminjaman biasa.
function hideLoanItemDropdown() {
    const dropdown = document.getElementById('loan-item-dropdown');
    if (dropdown) dropdown.classList.add('hidden');
}
// Menyembunyikan dropdown dengan sedikit delay, supaya klik pada item dropdown tetap sempat diproses sebelum blur.
function hideLoanItemDropdownDelayed() {
    setTimeout(hideLoanItemDropdown, 150);
}
function submitLoanForm(e) {
    e.preventDefault();
    const db = getDB();
    const itemId = document.getElementById('loan-item').value;
    const item = db.items.find(i => i.id === itemId);
    if (!item) { toast('Silakan pilih barang terlebih dahulu dari daftar pencarian.', 'danger'); return; }
    const qty = Number(document.getElementById('loan-qty').value);
    if (qty < 1 || qty > item.stock) { toast('Jumlah melebihi stok tersedia.', 'danger'); return; }
    // Stok BELUM dikurangi di sini - baru dikurangi setelah disetujui Admin
    db.loans.push({
        id: uid('loan'), itemId, itemName: item.name, qty,
        borrower: document.getElementById('loan-borrower').value.trim(),
        borrowDate: document.getElementById('loan-date').value,
        returnPlan: document.getElementById('loan-return-plan').value,
        notes: document.getElementById('loan-notes').value.trim(),
        status: 'menunggu_admin', requestedBy: currentUser().name
    });
    saveDB(db);
    toast('Peminjaman berhasil diajukan, menunggu persetujuan Admin.');
    switchLoanTab('persetujuan');
    renderSidebar();
}
/* ---------- Form Peminjaman Event (banyak barang sekaligus) ----------
   Semua barang yang dipilih di form ini digabung dalam satu "paket" (eventId)
   sehingga diajukan, disetujui, ditolak, dan dikembalikan bersama-sama sebagai
   satu kesatuan, tanpa perlu memproses satu per satu untuk tiap barang. */
let eventItemRowSeq = 0; // penghitung untuk membuat id unik tiap baris barang di form Peminjaman Event
let eventLoanItemsCache = null; // cache daftar barang berstok agar tidak query berulang saat mengetik di pencarian
// Mengambil (dan menyimpan sementara/cache) daftar barang dengan stok > 0 untuk kotak pencarian
// pada form Peminjaman Event, supaya tidak query database berulang kali saat mengetik.
function getEventLoanItems() {
    if (!eventLoanItemsCache) {
        const db = getDB();
        eventLoanItemsCache = db.items.filter(i => i.stock > 0);
    }
    return eventLoanItemsCache;
}
// Membangun HTML form 'Peminjaman Event' (peminjaman banyak barang sekaligus dalam satu paket).
function renderEventLoanForm() {
    eventLoanItemsCache = null; // refresh cache stok setiap kali form dibuka
    return `
    <div class="table-container">
        <div class="modal-body">
            <p class="text-muted" style="margin-bottom:16px;">Gunakan form ini untuk mengajukan peminjaman banyak barang sekaligus untuk keperluan event/acara. Seluruh barang akan diajukan, disetujui, dan dikembalikan sebagai satu paket.</p>
            <form id="event-loan-form" onsubmit="submitEventLoanForm(event)">
                <div class="form-row">
                    <div class="form-group"><label>Nama Event / Acara</label><input type="text" id="event-name" placeholder="cth: Wedding Ibu Sari - Ballroom Hotel X" required></div>
                    <div class="form-group"><label>Nama User / PIC Event (penanggung jawab)</label><input type="text" id="event-borrower" value="${escapeHtml(currentUser().name)}" required></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Lokasi Event (opsional)</label><input type="text" id="event-location" placeholder="cth: Hotel X, Jakarta"></div>
                    <div class="form-group"><label>Tanggal Pinjam</label><input type="date" id="event-date" value="${todayStr()}" required></div>
                </div>
                <div class="form-group"><label>Rencana Kembali</label><input type="date" id="event-return-plan" required></div>
                <div class="form-group"><label>Catatan Umum (opsional)</label><textarea id="event-notes" placeholder="catatan tambahan untuk event ini"></textarea></div>

                <div class="form-group">
                    <label>Daftar Barang yang Dipinjam</label>
                    <div id="event-items-wrap"></div>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="addEventItemRow()" style="margin-top:6px;"><i data-lucide="plus"></i>Tambah Barang</button>
                </div>
                <p class="text-muted" style="margin:12px 0;">Pengajuan ini akan diproses sebagai satu paket, menunggu persetujuan Admin sebelum seluruh barang boleh diambil.</p>
                <button type="submit" class="btn btn-primary">Ajukan Peminjaman Event</button>
            </form>
        </div>
    </div>`;
}
// Menambahkan satu baris input barang baru (pencarian + jumlah) ke form Peminjaman Event.
function addEventItemRow() {
    const wrap = document.getElementById('event-items-wrap');
    if (!wrap) return;
    const rowId = 'evrow-' + (++eventItemRowSeq);
    const hasItems = getEventLoanItems().length > 0;
    const div = document.createElement('div');
    div.className = 'event-item-row';
    div.id = rowId;
    div.innerHTML = `
        <div class="ev-item-search-wrap">
            <input type="text" class="ev-item-search" placeholder="${hasItems ? 'Cari nama atau ID barang...' : 'Tidak ada barang tersedia'}" autocomplete="off" ${hasItems ? '' : 'disabled'}
                oninput="onEventItemSearchInput('${rowId}')" onfocus="onEventItemSearchInput('${rowId}')" onblur="hideEventItemDropdownDelayed('${rowId}')">
            <input type="hidden" class="ev-item-select" value="">
            <div class="ev-item-dropdown hidden" id="${rowId}-dropdown"></div>
        </div>
        <input type="number" class="ev-item-qty" min="1" value="1" required>
        <button type="button" class="btn-icon text-danger" title="Hapus barang ini" onclick="removeEventItemRow('${rowId}')"><i data-lucide="trash-2"></i></button>
    `;
    wrap.appendChild(div);
    if (window.lucide) lucide.createIcons();
}
// Menghapus satu baris input barang dari form Peminjaman Event.
function removeEventItemRow(rowId) {
    const el = document.getElementById(rowId);
    if (el) el.remove();
}
/* ---------- Pencarian barang (autocomplete) untuk baris Peminjaman Event ---------- */
function onEventItemSearchInput(rowId) {
    const row = document.getElementById(rowId);
    if (!row) return;
    const query = row.querySelector('.ev-item-search').value.trim().toLowerCase();
    const items = getEventLoanItems();
    const filtered = query
        ? items.filter(i => i.name.toLowerCase().includes(query) || i.id.toLowerCase().includes(query))
        : items;
    renderEventItemDropdown(rowId, filtered.slice(0, 50));
}
// Merender daftar dropdown saran barang (autocomplete) untuk satu baris tertentu pada form Peminjaman Event.
function renderEventItemDropdown(rowId, items) {
    const dropdown = document.getElementById(rowId + '-dropdown');
    if (!dropdown) return;
    if (!items.length) {
        dropdown.innerHTML = `<div class="ev-item-dropdown-empty">Barang tidak ditemukan.</div>`;
    } else {
        dropdown.innerHTML = items.map(i => `
            <div class="ev-item-dropdown-item" onmousedown="event.preventDefault(); selectEventItemFromDropdown('${rowId}', '${i.id}')">
                <span class="ev-item-dropdown-name">${escapeHtml(i.name)}</span>
                <span class="ev-item-dropdown-meta">[${escapeHtml(i.id)}] &middot; stok: ${i.stock} ${escapeHtml(i.unit || '')}</span>
            </div>`).join('');
    }
    dropdown.classList.remove('hidden');
}
// Mengisi baris form Peminjaman Event dengan barang yang dipilih dari dropdown, lalu menyembunyikan dropdown.
function selectEventItemFromDropdown(rowId, itemId) {
    const row = document.getElementById(rowId);
    if (!row) return;
    const item = getEventLoanItems().find(i => i.id === itemId);
    if (!item) return;
    row.querySelector('.ev-item-select').value = item.id;
    row.querySelector('.ev-item-search').value = `[${item.id}] ${item.name} (stok: ${item.stock} ${item.unit || ''})`;
    hideEventItemDropdown(rowId);
}
// Menyembunyikan dropdown saran barang untuk satu baris tertentu.
function hideEventItemDropdown(rowId) {
    const dropdown = document.getElementById(rowId + '-dropdown');
    if (dropdown) dropdown.classList.add('hidden');
}
// Menyembunyikan dropdown dengan sedikit delay, supaya event klik/mousedown pada item dropdown
// (yang terjadi sebelum blur) tetap sempat diproses terlebih dahulu.
function hideEventItemDropdownDelayed(rowId) {
    setTimeout(() => hideEventItemDropdown(rowId), 150);
}
// Mengajukan peminjaman event: menggabungkan jumlah bila ada barang yang sama dipilih di beberapa baris,
// memvalidasi stok tiap barang, lalu membuat satu record peminjaman per barang yang ditandai eventId yang sama.
function submitEventLoanForm(e) {
    e.preventDefault();
    const db = getDB();
    const eventName = document.getElementById('event-name').value.trim();
    const borrower = document.getElementById('event-borrower').value.trim();
    const location = document.getElementById('event-location').value.trim();
    const borrowDate = document.getElementById('event-date').value;
    const returnPlan = document.getElementById('event-return-plan').value;
    const notes = document.getElementById('event-notes').value.trim();

    const rows = Array.from(document.querySelectorAll('#event-items-wrap .event-item-row'));
    if (!rows.length) { toast('Tambahkan minimal 1 barang untuk peminjaman event ini.', 'danger'); return; }

    // Gabungkan jumlah jika barang yang sama dipilih di lebih dari satu baris
    const picked = {};
    for (const row of rows) {
        const itemId = row.querySelector('.ev-item-select').value;
        const qty = Number(row.querySelector('.ev-item-qty').value);
        if (!itemId) { toast('Pilih barang pada setiap baris yang ditambahkan.', 'danger'); return; }
        if (!qty || qty < 1) { toast('Jumlah barang harus lebih dari 0.', 'danger'); return; }
        picked[itemId] = (picked[itemId] || 0) + qty;
    }
    for (const itemId in picked) {
        const item = db.items.find(i => i.id === itemId);
        if (!item || picked[itemId] > item.stock) {
            toast(`Jumlah "${item ? item.name : itemId}" melebihi stok tersedia.`, 'danger');
            return;
        }
    }

    const eventId = uid('event');
    Object.keys(picked).forEach(itemId => {
        const item = db.items.find(i => i.id === itemId);
        db.loans.push({
            id: uid('loan'), itemId, itemName: item.name, qty: picked[itemId],
            borrower, borrowDate, returnPlan, notes,
            status: 'menunggu_admin', requestedBy: currentUser().name,
            eventId, eventName, eventLocation: location
        });
    });
    saveDB(db);
    toast(`Peminjaman event "${eventName}" berhasil diajukan (${Object.keys(picked).length} jenis barang), menunggu persetujuan Admin.`);
    switchLoanTab('persetujuan');
    renderSidebar();
}
// Memisahkan daftar peminjaman menjadi kelompok paket event (dikelompokkan berdasarkan eventId)
// dan peminjaman satuan (bukan bagian dari event).
function groupLoansByEvent(list) {
    const groups = {};
    const singles = [];
    list.forEach(l => {
        if (l.eventId) {
            if (!groups[l.eventId]) groups[l.eventId] = [];
            groups[l.eventId].push(l);
        } else {
            singles.push(l);
        }
    });
    return { groups, singles };
}
// Membangun tabel checklist (Excel-style) + blok tanda tangan untuk dicetak.
// items: array {itemId, itemName, qty}. header: info peminjaman (peminjam, tanggal, dst).
function buildLoanChecklistPrintHtml(header, items) {
    const rows = items.map((it, idx) => `
        <tr>
            <td style="border:1px solid #000;padding:6px;text-align:center;">${idx + 1}</td>
            <td style="border:1px solid #000;padding:6px;">${escapeHtml(it.itemId)}</td>
            <td style="border:1px solid #000;padding:6px;">${escapeHtml(it.itemName)}</td>
            <td style="border:1px solid #000;padding:6px;text-align:center;">${it.qty}</td>
            <td style="border:1px solid #000;padding:6px;text-align:center;">&#9633;</td>
            <td style="border:1px solid #000;padding:6px;text-align:center;">&#9633;</td>
            <td style="border:1px solid #000;padding:6px;text-align:center;">&#9633;</td>
            <td style="border:1px solid #000;padding:6px;text-align:center;">&#9633;</td>
            <td style="border:1px solid #000;padding:6px;"></td>
        </tr>`).join('');
    return `
        <div style="text-align:center;margin-bottom:20px;">
            <h2 style="margin-bottom:4px;">FORM SERAH TERIMA PEMINJAMAN BARANG</h2>
            <p style="color:#555;">GudangKita - Sistem Manajemen Stok & Peminjaman</p>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
            ${header.eventName ? `<tr><td style="padding:4px 0;width:180px;"><strong>Nama Event</strong></td><td>: ${escapeHtml(header.eventName)}</td></tr>` : ''}
            ${header.eventLocation ? `<tr><td style="padding:4px 0;"><strong>Lokasi</strong></td><td>: ${escapeHtml(header.eventLocation)}</td></tr>` : ''}
            <tr><td style="padding:4px 0;width:180px;"><strong>User / Peminjam</strong></td><td>: ${escapeHtml(header.borrower)}</td></tr>
            <tr><td style="padding:4px 0;"><strong>Tanggal Pinjam</strong></td><td>: ${fmtDate(header.borrowDate)}</td></tr>
            <tr><td style="padding:4px 0;"><strong>Rencana Kembali</strong></td><td>: ${fmtDate(header.returnPlan)}</td></tr>
            <tr><td style="padding:4px 0;"><strong>Penyedia Barang (Admin)</strong></td><td>: ${escapeHtml(header.adminApprovedBy || '-')}</td></tr>
        </table>
        <table style="width:100%;border-collapse:collapse;margin-bottom:8px;font-size:13px;">
            <thead>
                <tr>
                    <th rowspan="2" style="border:1px solid #000;padding:6px;">No</th>
                    <th rowspan="2" style="border:1px solid #000;padding:6px;">ID Barang</th>
                    <th rowspan="2" style="border:1px solid #000;padding:6px;">Nama Barang</th>
                    <th rowspan="2" style="border:1px solid #000;padding:6px;">Jumlah</th>
                    <th colspan="4" style="border:1px solid #000;padding:6px;">Checklist</th>
                    <th rowspan="2" style="border:1px solid #000;padding:6px;">Catatan</th>
                </tr>
                <tr>
                    <th style="border:1px solid #000;padding:4px;">Admin</th>
                    <th style="border:1px solid #000;padding:4px;">Ambil</th>
                    <th style="border:1px solid #000;padding:4px;">Kembali</th>
                    <th style="border:1px solid #000;padding:4px;">Admin</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
        <table style="width:100%;margin-top:60px;border-collapse:collapse;text-align:center;">
            <tr>
                <td style="width:25%;"></td>
                <td style="width:25%;"><strong>Pengambilan</strong></td>
                <td style="width:25%;"><strong>Pengembalian</strong></td>
                <td style="width:25%;"></td>
            </tr>
            <tr>
                <td><strong>Penyedia Barang<br>(Yang Menyiapkan)</strong></td>
                <td style="padding-top:50px;">(${escapeHtml(header.adminApprovedBy || '...........................')})</td>
                <td style="padding-top:50px;">(${escapeHtml(header.adminApprovedBy || '...........................')})</td>
                <td></td>
            </tr>
            <tr>
                <td><strong>User / Peminjam<br>(Penanggung Jawab)</strong></td>
                <td style="padding-top:50px;">(${escapeHtml(header.borrower || '...........................')})</td>
                <td style="padding-top:50px;">(${escapeHtml(header.borrower || '...........................')})</td>
                <td></td>
            </tr>
        </table>`;
}
// Cetak form serah terima untuk 1 peminjaman satuan (bukan bagian dari event).
function printSingleLoan(loanId) {
    const db = getDB();
    const loan = db.loans.find(l => l.id === loanId && l.status === 'dipinjam');
    if (!loan) return;
    const html = buildLoanChecklistPrintHtml(loan, [{ itemId: loan.itemId, itemName: loan.itemName, qty: loan.qty }]);
    document.getElementById('print-area').innerHTML = html;
    window.print();
}
// Cetak form serah terima untuk 1 paket peminjaman Event (banyak barang sekaligus).
function printEventLoan(eventId) {
    const db = getDB();
    const items = db.loans.filter(l => l.eventId === eventId && l.status === 'dipinjam');
    if (!items.length) return;
    const first = items[0];
    const html = buildLoanChecklistPrintHtml(first, items.map(l => ({ itemId: l.itemId, itemName: l.itemName, qty: l.qty })));
    document.getElementById('print-area').innerHTML = html;
    window.print();
}
// Persetujuan 1 tahap: cukup Admin. Stok langsung dipotong setelah Admin menyetujui.
function approveLoanStage(loanId, stage) {
    const db = getDB();
    const loan = db.loans.find(l => l.id === loanId);
    if (!loan) return;
    if (stage === 'admin') {
        if (loan.status !== 'menunggu_admin') return;
        const item = db.items.find(i => i.id === loan.itemId);
        if (!item || item.stock < loan.qty) {
            toast('Stok tidak lagi mencukupi. Peminjaman tidak dapat disetujui.', 'danger');
            return;
        }
        item.stock -= loan.qty;
        loan.status = 'dipinjam';
        loan.adminApprovedBy = currentUser().name;
        loan.adminApprovedDate = todayStr();
        saveDB(db);
        toast('Peminjaman disetujui Admin. Stok diperbarui, barang siap diambil.');
    }
    renderPage('loans');
    renderSidebar();
}
// Admin menolak satu pengajuan peminjaman, dengan alasan opsional.
function rejectLoan(loanId) {
    const db = getDB();
    const loan = db.loans.find(l => l.id === loanId);
    if (!loan) return;
    const reason = prompt('Alasan penolakan (opsional):', '') || '';
    loan.status = 'ditolak';
    loan.rejectedBy = currentUser().name;
    loan.rejectedDate = todayStr();
    loan.rejectReason = reason.trim();
    saveDB(db);
    toast('Pengajuan peminjaman ditolak.', 'warning');
    renderPage('loans');
    renderSidebar();
}
/* ---------- Form Pengembalian (alur baru) ----------
   1) Diajukan (status -> menunggu_admin_pengembalian) untuk SEMUA kondisi.
   2) Admin memeriksa: kalau kondisi "Baik" -> langsung final di tahap Admin saja.
      Kalau bermasalah (rusak/mt/hilang/habis pakai) -> diteruskan ke Manajemen.
   3) Manajemen menyetujui -> baru di sini stok/kerusakan/hilang/habis-pakai diproses final. */
/* =========================================================
   MODUL KENDALA PENGEMBALIAN (satu barang boleh punya banyak kendala sekaligus)
   ---------------------------------------------------------
   Konsep data yang disimpan pada setiap peminjaman:
       loan.pendingIssues = [
           { id, type: 'hilang'|'habis'|'rusak'|'maintenance', qty, note, photo },
           ...
       ]
   Setiap kendala adalah RECORD TERSENDIRI (tidak digabung jadi satu angka), sehingga
   satu barang bisa punya "Habis: 3" dan "Rusak: 2" sekaligus. Sisa unit yang tidak
   tercakup kendala apa pun dianggap kembali dalam kondisi baik dan masuk lagi ke stok.
   ========================================================= */
const KENDALA_TYPES = [
    { value: 'hilang',      label: 'Hilang',      badge: 'badge-danger',  photoRequired: false },
    { value: 'habis',       label: 'Habis',       badge: 'badge-info',    photoRequired: true  },
    { value: 'rusak',       label: 'Rusak',       badge: 'badge-danger',  photoRequired: false },
    { value: 'maintenance', label: 'Maintenance', badge: 'badge-warning', photoRequired: false }
];
function kendalaMeta(type) { return KENDALA_TYPES.find(t => t.value === type) || null; }
function kendalaLabel(type) { const m = kendalaMeta(type); return m ? m.label : (type || '-'); }
function kendalaBadgeClass(type) { const m = kendalaMeta(type); return m ? m.badge : 'badge-muted'; }
function kendalaNeedsPhoto(type) { const m = kendalaMeta(type); return !!(m && m.photoRequired); }

// Draft kendala yang sedang disusun di form, dikelompokkan per "key".
// key = 'single' untuk pengembalian biasa, atau loan.id untuk tiap baris pengembalian event.
let returnIssueDraft = {};
// Menandai barang mana yang boleh memakai kendala "Habis": hanya barang yang
// dicentang sebagai Barang Habis Pakai/ATK di Data Barang (item.isConsumable).
let returnIssueAllowHabis = {};
function initKendalaDraft(key, allowHabis) {
    returnIssueDraft[key] = [];
    returnIssueAllowHabis[key] = !!allowHabis;
}
// Daftar jenis kendala yang tersedia untuk satu barang tertentu.
function kendalaTypesFor(key) {
    return returnIssueAllowHabis[key] ? KENDALA_TYPES : KENDALA_TYPES.filter(t => t.value !== 'habis');
}
function getKendalaDraft(key) {
    if (!returnIssueDraft[key]) returnIssueDraft[key] = [];
    return returnIssueDraft[key];
}
function kendalaTotalQty(list) { return (list || []).reduce((sum, k) => sum + (Number(k.qty) || 0), 0); }

// Kerangka HTML blok "Kendala" untuk satu barang (tombol + daftar kendala + ringkasan).
function kendalaFieldHtml(key, maxQty) {
    return `
    <div class="kendala-box">
        <div class="kendala-head">
            <div>
                <div class="kendala-title">Kendala Barang</div>
                <div class="kendala-hint">Tekan "Kendala" bila ada unit yang bermasalah. Satu barang boleh punya lebih dari satu kendala sekaligus.${returnIssueAllowHabis[key] ? '' : '<br>Jenis kendala <strong>Habis</strong> hanya tersedia untuk Barang Habis Pakai/ATK.'}</div>
            </div>
            <button type="button" class="btn btn-sm btn-warning" onclick="addKendalaRow('${key}', ${maxQty})">
                <i data-lucide="alert-triangle"></i>Kendala
            </button>
        </div>
        <div id="kendala-rows-${key}"></div>
        <div class="kendala-summary" id="kendala-summary-${key}"></div>
    </div>`;
}
// Menambah satu baris kendala baru. Jenis yang belum terpakai dipilih otomatis supaya tidak dobel.
function addKendalaRow(key, maxQty) {
    const list = getKendalaDraft(key);
    const sisa = maxQty - kendalaTotalQty(list);
    if (sisa <= 0) {
        toast(`Seluruh ${maxQty} unit sudah tercakup kendala. Ubah jumlah pada kendala yang ada bila perlu.`, 'warning');
        return;
    }
    const tersedia = kendalaTypesFor(key);
    if (list.length >= tersedia.length) {
        toast('Semua jenis kendala sudah ditambahkan untuk barang ini.', 'warning');
        return;
    }
    const used = list.map(k => k.type);
    const next = tersedia.find(t => !used.includes(t.value)) || tersedia[0];
    list.push({ id: uid('kdl'), type: next.value, qty: Math.min(1, sisa), note: '', photo: '' });
    renderKendalaRows(key, maxQty);
}
// Menghapus satu baris kendala.
function removeKendalaRow(key, id, maxQty) {
    returnIssueDraft[key] = getKendalaDraft(key).filter(k => k.id !== id);
    renderKendalaRows(key, maxQty);
}
// Memperbarui satu field pada baris kendala. rerender=true dipakai saat jenis kendala berubah
// (karena kewajiban foto ikut berubah); selain itu cukup ringkasannya yang di-refresh supaya
// fokus ketikan pengguna tidak hilang.
function updateKendalaRow(key, id, field, value, maxQty, rerender) {
    const k = getKendalaDraft(key).find(x => x.id === id);
    if (!k) return;
    if (field === 'qty') {
        let n = Math.floor(Number(value) || 0);
        if (n < 0) n = 0;
        k.qty = n;
    } else {
        k[field] = value;
    }
    if (rerender) renderKendalaRows(key, maxQty);
    else updateKendalaSummary(key, maxQty);
}
// Menggambar ulang seluruh baris kendala pada satu barang.
function renderKendalaRows(key, maxQty) {
    const wrap = document.getElementById(`kendala-rows-${key}`);
    if (!wrap) return;
    const list = getKendalaDraft(key);
    wrap.innerHTML = list.map((k, idx) => {
        const wajibFoto = kendalaNeedsPhoto(k.type);
        return `
        <div class="kendala-row">
            <div class="kendala-row-head">
                <span class="badge ${kendalaBadgeClass(k.type)}">Kendala ${idx + 1}: ${kendalaLabel(k.type)}</span>
                <button type="button" class="btn-icon text-danger" title="Hapus kendala ini" onclick="removeKendalaRow('${key}','${k.id}',${maxQty})">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Jenis Kendala</label>
                    <select onchange="updateKendalaRow('${key}','${k.id}','type',this.value,${maxQty},true)">
                        ${kendalaTypesFor(key).map(t => `<option value="${t.value}" ${t.value === k.type ? 'selected' : ''}>${t.label}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Jumlah Unit Bermasalah</label>
                    <input type="number" min="1" max="${maxQty}" value="${k.qty}"
                           oninput="updateKendalaRow('${key}','${k.id}','qty',this.value,${maxQty},false)">
                </div>
            </div>
            <div class="form-group">
                <label>Keterangan / Kronologi (opsional)</label>
                <textarea rows="2" placeholder="cth: jatuh saat pemasangan, layar pecah"
                          oninput="updateKendalaRow('${key}','${k.id}','note',this.value,${maxQty},false)">${escapeHtml(k.note || '')}</textarea>
            </div>
            <div class="form-group">
                <label>Foto Bukti ${wajibFoto ? '<span class="text-danger">(wajib untuk kendala Habis)</span>' : '(opsional)'}</label>
                <div style="display:flex;gap:8px;">
                    <div class="upload-box" style="flex:1;" onclick="document.getElementById('kendala-file-${key}-${k.id}').click()">
                        <i data-lucide="upload"></i><div>Unggah dari galeri</div>
                    </div>
                    <div class="upload-box" style="flex:1;" onclick="captureKendalaPhoto('${key}','${k.id}',${maxQty})">
                        <i data-lucide="camera"></i><div>Ambil foto langsung</div>
                    </div>
                </div>
                <input type="file" class="hidden" accept="image/*" id="kendala-file-${key}-${k.id}"
                       onchange="uploadKendalaPhoto(event,'${key}','${k.id}',${maxQty})">
                ${k.photo ? `<img src="${k.photo}" class="upload-preview">` : ''}
            </div>
        </div>`;
    }).join('');
    updateKendalaSummary(key, maxQty);
    if (window.lucide) lucide.createIcons();
}
// Ringkasan hidup: total unit bermasalah vs total unit yang dikembalikan, plus sisa unit tanpa kendala.
function updateKendalaSummary(key, maxQty) {
    const el = document.getElementById(`kendala-summary-${key}`);
    if (!el) return;
    const list = getKendalaDraft(key);
    if (!list.length) {
        el.innerHTML = `<span class="badge badge-success">Tanpa kendala</span>
            <span class="kendala-hint">Seluruh ${maxQty} unit dianggap kembali dalam kondisi baik.</span>`;
        return;
    }
    const total = kendalaTotalQty(list);
    const sisa = maxQty - total;
    const lebih = total > maxQty;
    el.innerHTML = `
        <div class="kendala-summary-list">
            ${list.map(k => `<span class="badge ${kendalaBadgeClass(k.type)}">${kendalaLabel(k.type)}: ${Number(k.qty) || 0} unit</span>`).join('')}
        </div>
        <div class="${lebih ? 'text-danger' : 'kendala-hint'}" style="margin-top:6px;">
            Total bermasalah: <strong>${total}</strong> dari ${maxQty} unit &middot;
            ${lebih
                ? `Melebihi jumlah barang yang dikembalikan (maks ${maxQty}).`
                : `Sisa <strong>${sisa}</strong> unit tanpa kendala &rarr; kembali ke stok.`}
        </div>`;
}
// Mengambil foto bukti kendala lewat kamera realtime (berwatermark tanggal/waktu/lokasi).
function captureKendalaPhoto(key, id, maxQty) {
    openCameraCapture((dataUrl) => {
        const k = getKendalaDraft(key).find(x => x.id === id);
        if (!k) return;
        k.photo = dataUrl;
        renderKendalaRows(key, maxQty);
    }, 'Ambil Foto Bukti Kendala');
}
// Mengunggah foto bukti kendala dari galeri/berkas.
function uploadKendalaPhoto(e, key, id, maxQty) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
        const k = getKendalaDraft(key).find(x => x.id === id);
        if (!k) return;
        k.photo = ev.target.result;
        renderKendalaRows(key, maxQty);
    };
    reader.readAsDataURL(file);
}
// Validasi terpusat sebelum data disimpan (dipakai form biasa maupun form event).
// Mengembalikan { ok, msg } atau { ok:true, issues, total, qtyGood }.
function validateKendalaDraft(key, maxQty, itemName) {
    const raw = getKendalaDraft(key);
    const label = itemName ? `"${itemName}"` : 'barang ini';
    const issues = raw.map(k => ({
        id: k.id, type: k.type, qty: Math.floor(Number(k.qty) || 0),
        note: (k.note || '').trim(), photo: k.photo || ''
    }));
    for (const k of issues) {
        if (!kendalaMeta(k.type)) return { ok: false, msg: `Jenis kendala tidak dikenal pada ${label}.` };
        if (k.type === 'habis' && !returnIssueAllowHabis[key]) {
            return { ok: false, msg: `Kendala "Habis" hanya berlaku untuk Barang Habis Pakai/ATK, sedangkan ${label} bukan barang habis pakai.` };
        }
        if (k.qty <= 0) return { ok: false, msg: `Jumlah unit untuk kendala ${kendalaLabel(k.type)} pada ${label} minimal 1.` };
        if (kendalaNeedsPhoto(k.type) && !k.photo) return { ok: false, msg: `Foto bukti wajib untuk kendala ${kendalaLabel(k.type)} pada ${label}.` };
    }
    const types = issues.map(k => k.type);
    const dobel = types.find((t, i) => types.indexOf(t) !== i);
    if (dobel) return { ok: false, msg: `Kendala ${kendalaLabel(dobel)} pada ${label} ditambahkan lebih dari sekali. Gabungkan jumlahnya dalam satu baris.` };
    const total = kendalaTotalQty(issues);
    if (total > maxQty) return { ok: false, msg: `Total unit bermasalah (${total}) pada ${label} melebihi jumlah yang dikembalikan (${maxQty}).` };
    return { ok: true, issues, total, qtyGood: maxQty - total };
}
// Menyimpulkan satu label kondisi ringkas dari daftar kendala (dipakai agar tampilan & data lama tetap kompatibel).
function conditionFromIssues(issues) {
    if (!issues || !issues.length) return 'baik';
    if (issues.length === 1) {
        const map = { hilang: 'hilang', habis: 'habis_pakai', rusak: 'rusak', maintenance: 'mt' };
        return map[issues[0].type] || 'campuran';
    }
    return 'campuran';
}
// Menyusun kalimat kronologi gabungan dari seluruh kendala (untuk kolom keterangan/riwayat).
function kendalaChronologyText(issues) {
    return (issues || [])
        .map(k => `${kendalaLabel(k.type)} (${k.qty} unit)${k.note ? ': ' + k.note : ''}`)
        .join(' | ');
}
// Rangkaian badge ringkas untuk ditampilkan di tabel persetujuan/riwayat.
function kendalaSummaryHtml(issues, totalQty) {
    if (!issues || !issues.length) return '<span class="badge badge-success">Tanpa kendala</span>';
    const total = kendalaTotalQty(issues);
    const sisa = (Number(totalQty) || 0) - total;
    const badges = issues.map(k => `<span class="badge ${kendalaBadgeClass(k.type)}">${kendalaLabel(k.type)}: ${k.qty}</span>`).join(' ');
    return badges + (sisa > 0 ? ` <span class="badge badge-success">Baik: ${sisa}</span>` : '');
}
// Sel kondisi untuk pengajuan yang sedang menunggu persetujuan (fallback ke data lama tanpa kendala).
function pendingConditionCell(loan) {
    if (Array.isArray(loan.pendingIssues)) return kendalaSummaryHtml(loan.pendingIssues, loan.qty);
    return conditionBadge(loan.pendingCondition);
}
// Sel kondisi untuk riwayat pengembalian yang sudah final.
function historyConditionCell(loan) {
    if (Array.isArray(loan.issues)) return kendalaSummaryHtml(loan.issues, loan.qty);
    return conditionBadge(loan.condition);
}
// Menampilkan rincian lengkap tiap kendala (jumlah, keterangan, foto bukti) dalam modal.
function viewKendalaDetail(loanId) {
    const db = getDB();
    const loan = db.loans.find(l => l.id === loanId);
    if (!loan) return;
    const issues = Array.isArray(loan.pendingIssues) ? loan.pendingIssues
                 : (Array.isArray(loan.issues) ? loan.issues : null);
    if (!issues) {
        openModal(`Detail Pengembalian - ${loan.itemName}`, `
            <p>Kondisi: ${conditionBadge(loan.pendingCondition || loan.condition)}</p>
            <p class="text-muted">${escapeHtml(loan.pendingChronology || loan.returnNotes || 'Tidak ada keterangan tambahan.')}</p>`);
        return;
    }
    const total = kendalaTotalQty(issues);
    const sisa = loan.qty - total;
    openModal(`Detail Kendala - ${loan.itemName}`, `
        <p class="text-muted" style="margin-bottom:12px;">
            Total dikembalikan: <strong>${loan.qty} unit</strong> &middot;
            Bermasalah: <strong>${total} unit</strong> &middot;
            Tanpa kendala: <strong>${sisa < 0 ? 0 : sisa} unit</strong>
        </p>
        ${issues.length ? issues.map(k => `
            <div class="kendala-row">
                <div class="kendala-row-head">
                    <span class="badge ${kendalaBadgeClass(k.type)}">${kendalaLabel(k.type)}: ${k.qty} unit</span>
                </div>
                <p style="margin:0 0 6px;">${escapeHtml(k.note || 'Tanpa keterangan.')}</p>
                ${k.photo ? `<img src="${k.photo}" class="kendala-detail-photo">` : '<p class="text-muted" style="margin:0;">Tidak ada foto bukti.</p>'}
            </div>`).join('') : '<p class="text-muted">Tidak ada kendala yang dilaporkan.</p>'}
        ${loan.pendingLastLocation ? `<p class="text-muted">Lokasi terakhir terlihat: ${escapeHtml(loan.pendingLastLocation)}</p>` : ''}
    `);
}
function openReturnForm(loanId) {
    const db = getDB();
    const loan = db.loans.find(l => l.id === loanId);
    if (!loan) return;
    const item = db.items.find(i => i.id === loan.itemId);
    const key = 'single';
    initKendalaDraft(key, !!(item && item.isConsumable));
    openModal('Ajukan Pengembalian Barang', `
        <form id="return-form" onsubmit="submitReturnForm(event, '${loanId}')">
            <div class="kendala-item-head">
                ${escapeHtml(loan.itemName)}
                <span class="text-muted">&middot; dikembalikan: ${loan.qty} unit</span>
            </div>
            ${kendalaFieldHtml(key, loan.qty)}
            <div class="form-group"><label>Lokasi Terakhir Terlihat (opsional)</label>
                <input type="text" id="return-lastloc" placeholder="cth: Ruang Meeting Lt.2">
            </div>
            <div class="form-group"><label>Catatan Pengembalian (opsional)</label><textarea id="return-notes"></textarea></div>
            <p class="text-muted" style="margin-bottom:12px;">Pengembalian tanpa kendala cukup persetujuan Admin. Bila ada kendala, perlu persetujuan Admin lalu Manajemen.</p>
            <button type="submit" class="btn btn-primary">Ajukan Pengembalian</button>
        </form>
    `);
    renderKendalaRows(key, loan.qty);
}
// Mengajukan pengembalian satu barang beserta seluruh kendalanya (bisa lebih dari satu jenis).
function submitReturnForm(e, loanId) {
    e.preventDefault();
    const db = getDB();
    const loan = db.loans.find(l => l.id === loanId);
    if (!loan) return;
    const res = validateKendalaDraft('single', loan.qty, loan.itemName);
    if (!res.ok) { toast(res.msg, 'danger'); return; }
    loan.status = 'menunggu_admin_pengembalian';
    loan.pendingIssues = res.issues;                       // record kendala tersimpan terpisah per jenis
    loan.pendingCondition = conditionFromIssues(res.issues);
    loan.pendingChronology = kendalaChronologyText(res.issues);
    loan.pendingLastLocation = document.getElementById('return-lastloc').value.trim();
    loan.pendingReturnNotes = document.getElementById('return-notes').value.trim();
    loan.returnSubmittedBy = currentUser().name;
    loan.returnSubmittedDate = todayStr();
    delete loan.pendingQtyRecovered; delete loan.pendingPhoto;
    if (!saveDB(db)) return;
    closeModal();
    toast(res.issues.length
        ? `Pengembalian diajukan dengan ${res.issues.length} kendala (${res.total} dari ${loan.qty} unit bermasalah), menunggu Admin.`
        : 'Pengembalian diajukan, menunggu persetujuan Admin.', 'warning');
    returnTab = 'persetujuan';
    navigateTo('returns');
}
// Menghapus semua field "pending" milik satu pengajuan pengembalian (dipakai setelah final/ditolak).
function clearPendingReturnFields(loan) {
    delete loan.pendingCondition; delete loan.pendingChronology; delete loan.pendingLastLocation;
    delete loan.pendingQtyRecovered; delete loan.pendingPhoto; delete loan.pendingReturnNotes;
    delete loan.pendingIssues;
}
// Memproses final kondisi bermasalah (rusak/mt/hilang/habis pakai) ke modul terkait. Dipanggil oleh
// Manajemen (approveReturnManajemen/approveEventReturnManajemen) setelah tahap Admin dilalui.
function finalizeProblemReturn(db, loan, condition) {
    // Alur baru: kendala tersimpan terstruktur di loan.pendingIssues.
    if (Array.isArray(loan.pendingIssues)) { finalizeIssuesReturn(db, loan); return; }
    // Alur lama (data yang dibuat sebelum fitur Kendala) tetap didukung.
    if (condition === 'hilang') {
        const qtyFound = Math.min(loan.pendingQtyRecovered || 0, loan.qty);
        const qtyLost = loan.qty - qtyFound;
        if (qtyFound > 0) { const item = db.items.find(i => i.id === loan.itemId); if (item) item.stock += qtyFound; }
        if (qtyLost > 0) {
            db.lost.push({
                id: uid('lost'), itemId: loan.itemId, itemName: loan.itemName, qty: qtyLost,
                lastLocation: loan.pendingLastLocation || '', description: loan.pendingChronology || '',
                source: 'pengembalian', loanId: loan.id,
                reportedBy: loan.returnSubmittedBy, date: todayStr(), status: 'writeoff'
            });
        }
    } else if (condition === 'rusak') {
        const qtyFixed = Math.min(loan.pendingQtyRecovered || 0, loan.qty);
        const qtyPermanent = loan.qty - qtyFixed;
        if (qtyFixed > 0) { const item = db.items.find(i => i.id === loan.itemId); if (item) item.stock += qtyFixed; }
        if (qtyPermanent > 0) {
            db.damages.push({
                id: uid('dmg'), itemId: loan.itemId, itemName: loan.itemName, qty: qtyPermanent,
                type: 'rusak', description: loan.pendingChronology || '', lastLocation: loan.pendingLastLocation || '',
                source: 'pengembalian', loanId: loan.id,
                reportedBy: loan.returnSubmittedBy, date: todayStr(), status: 'permanen'
            });
        }
    } else if (condition === 'mt') {
        const qtyMt = Math.min(loan.pendingQtyRecovered ?? loan.qty, loan.qty);
        const qtyGood = loan.qty - qtyMt;
        if (qtyGood > 0) { const item = db.items.find(i => i.id === loan.itemId); if (item) item.stock += qtyGood; }
        if (qtyMt > 0) {
            db.damages.push({
                id: uid('dmg'), itemId: loan.itemId, itemName: loan.itemName, qty: qtyMt,
                type: 'mt', description: loan.pendingChronology || '', lastLocation: loan.pendingLastLocation || '',
                source: 'pengembalian', loanId: loan.id,
                reportedBy: loan.returnSubmittedBy, date: todayStr(), status: 'menunggu'
            });
        }
    } else if (condition === 'habis_pakai') {
        db.consumables.push({
            id: uid('cons'), itemId: loan.itemId, itemName: loan.itemName, qty: loan.qty,
            level: 'habis_pakai', photo: loan.pendingPhoto || '', note: loan.pendingChronology || '',
            source: 'pengembalian', loanId: loan.id,
            reportedBy: loan.returnSubmittedBy, date: todayStr(), status: 'disetujui'
        });
    }
}
// Memproses seluruh kendala satu barang ke modul terkait. Tiap kendala jadi record sendiri:
//   hilang      -> Barang Hilang (writeoff)
//   rusak       -> Barang Rusak/MT (permanen)
//   maintenance -> Barang Rusak/MT (menunggu perbaikan)
//   habis       -> Barang Habis Pakai/ATK (beserta foto buktinya)
// Sisa unit yang tidak punya kendala dikembalikan ke stok.
function finalizeIssuesReturn(db, loan) {
    const issues = loan.pendingIssues || [];
    const totalProblem = kendalaTotalQty(issues);
    const qtyGood = Math.max(0, loan.qty - totalProblem);
    if (qtyGood > 0) {
        const item = db.items.find(i => i.id === loan.itemId);
        if (item) item.stock += qtyGood;
    }
    issues.forEach(k => {
        const qty = Number(k.qty) || 0;
        if (qty <= 0) return;
        const base = {
            itemId: loan.itemId, itemName: loan.itemName, qty,
            source: 'pengembalian', loanId: loan.id,
            reportedBy: loan.returnSubmittedBy, date: todayStr()
        };
        const desc = k.note || '';
        if (k.type === 'hilang') {
            db.lost.push(Object.assign({}, base, {
                id: uid('lost'), lastLocation: loan.pendingLastLocation || '',
                description: desc, photo: k.photo || '', status: 'writeoff'
            }));
        } else if (k.type === 'rusak') {
            db.damages.push(Object.assign({}, base, {
                id: uid('dmg'), type: 'rusak', description: desc,
                lastLocation: loan.pendingLastLocation || '', photo: k.photo || '', status: 'permanen'
            }));
        } else if (k.type === 'maintenance') {
            db.damages.push(Object.assign({}, base, {
                id: uid('dmg'), type: 'mt', description: desc,
                lastLocation: loan.pendingLastLocation || '', photo: k.photo || '', status: 'menunggu'
            }));
        } else if (k.type === 'habis') {
            db.consumables.push(Object.assign({}, base, {
                id: uid('cons'), level: 'habis_pakai', photo: k.photo || '',
                note: desc, status: 'disetujui'
            }));
        }
    });
}
// Admin memeriksa pengajuan pengembalian (tahap 1). Kondisi "Baik" langsung final di sini;
// kondisi bermasalah diteruskan ke Manajemen (tahap 2).
function approveReturnAdmin(loanId) {
    const db = getDB();
    const loan = db.loans.find(l => l.id === loanId);
    if (!loan || loan.status !== 'menunggu_admin_pengembalian') return;
    const condition = loan.pendingCondition;
    // Tanpa kendala sama sekali -> final di tahap Admin. Ada kendala -> lanjut ke Manajemen.
    const tanpaKendala = Array.isArray(loan.pendingIssues)
        ? loan.pendingIssues.length === 0
        : condition === 'baik';
    if (tanpaKendala) {
        const item = db.items.find(i => i.id === loan.itemId);
        if (item) item.stock += loan.qty;
        loan.status = 'dikembalikan';
        loan.returnDate = todayStr();
        loan.condition = 'baik';
        loan.issues = [];
        loan.returnNotes = loan.pendingReturnNotes || '';
        loan.processedBy = loan.returnSubmittedBy;
        loan.returnApprovedBy = currentUser().name;
        loan.adminReturnApprovedBy = currentUser().name;
        clearPendingReturnFields(loan);
        saveDB(db);
        toast('Pengembalian disetujui Admin & stok diperbarui.');
    } else {
        loan.status = 'menunggu_manajemen_pengembalian';
        loan.adminReturnApprovedBy = currentUser().name;
        loan.adminReturnApprovedDate = todayStr();
        saveDB(db);
        toast('Disetujui Admin, diteruskan ke Manajemen untuk persetujuan akhir.', 'warning');
    }
    renderPage('returns');
    renderSidebar();
}
// Admin menolak pengajuan pengembalian (tahap 1) -> barang kembali berstatus Sedang Dipinjam.
function rejectReturnAdmin(loanId) {
    const db = getDB();
    const loan = db.loans.find(l => l.id === loanId);
    if (!loan || loan.status !== 'menunggu_admin_pengembalian') return;
    if (!confirm('Tolak pengajuan pengembalian ini? Barang akan kembali berstatus Sedang Dipinjam.')) return;
    loan.status = 'dipinjam';
    clearPendingReturnFields(loan);
    delete loan.returnSubmittedBy; delete loan.returnSubmittedDate;
    saveDB(db);
    toast('Pengajuan pengembalian ditolak Admin, kembali ke status Sedang Dipinjam.', 'warning');
    renderPage('returns');
    renderSidebar();
}
// Manajemen menyetujui pengajuan pengembalian bermasalah (tahap 2, final) -> stok/kerusakan/hilang/habis-pakai diproses.
function approveReturnManajemen(loanId) {
    const db = getDB();
    const loan = db.loans.find(l => l.id === loanId);
    if (!loan || loan.status !== 'menunggu_manajemen_pengembalian') return;
    const condition = loan.pendingCondition;
    loan.status = 'dikembalikan';
    loan.returnDate = todayStr();
    loan.condition = condition;
    // Simpan salinan rincian kendala agar tetap terlihat di Riwayat Pengembalian.
    if (Array.isArray(loan.pendingIssues)) loan.issues = loan.pendingIssues.map(k => Object.assign({}, k));
    loan.returnNotes = loan.pendingReturnNotes || '';
    loan.processedBy = loan.returnSubmittedBy;
    loan.returnApprovedBy = currentUser().name;
    finalizeProblemReturn(db, loan, condition);
    clearPendingReturnFields(loan);
    saveDB(db);
    const jml = Array.isArray(loan.issues) ? loan.issues.length : 0;
    toast(jml > 1
        ? `Pengembalian disetujui. ${jml} kendala dicatat terpisah ke modul terkait.`
        : 'Pengembalian disetujui & kendala dicatat ke modul terkait.', 'warning');
    renderPage('returns');
    renderSidebar();
}
// Manajemen menolak pengajuan pengembalian (tahap 2) -> barang kembali berstatus Sedang Dipinjam, diproses ulang dari awal.
function rejectReturnManajemen(loanId) {
    const db = getDB();
    const loan = db.loans.find(l => l.id === loanId);
    if (!loan || loan.status !== 'menunggu_manajemen_pengembalian') return;
    if (!confirm('Tolak pengajuan pengembalian ini? Barang akan kembali berstatus Sedang Dipinjam.')) return;
    loan.status = 'dipinjam';
    clearPendingReturnFields(loan);
    delete loan.returnSubmittedBy; delete loan.returnSubmittedDate; delete loan.adminReturnApprovedBy; delete loan.adminReturnApprovedDate;
    saveDB(db);
    toast('Pengajuan pengembalian ditolak Manajemen, kembali ke status Sedang Dipinjam.', 'warning');
    renderPage('returns');
    renderSidebar();
}

/* ---------- Aksi & pengembalian khusus paket Peminjaman Event ---------- */
// Setujui semua barang dalam satu paket event sekaligus (cukup Admin, 1 tahap,
// sama seperti peminjaman biasa). Stok dicek dulu untuk semua barang sebelum
// ada satu pun yang dipotong, supaya tidak terjadi pemotongan stok sebagian.
function approveEventLoan(eventId) {
    const db = getDB();
    const items = db.loans.filter(l => l.eventId === eventId && l.status === 'menunggu_admin');
    if (!items.length) return;
    for (const loan of items) {
        const item = db.items.find(i => i.id === loan.itemId);
        if (!item || item.stock < loan.qty) {
            toast(`Stok "${loan.itemName}" tidak lagi mencukupi. Peminjaman event tidak dapat disetujui.`, 'danger');
            return;
        }
    }
    items.forEach(loan => {
        const item = db.items.find(i => i.id === loan.itemId);
        item.stock -= loan.qty;
        loan.status = 'dipinjam';
        loan.adminApprovedBy = currentUser().name;
        loan.adminApprovedDate = todayStr();
    });
    saveDB(db);
    toast(`Peminjaman event "${items[0].eventName}" disetujui Admin (${items.length} jenis barang). Stok diperbarui.`);
    renderPage('loans');
    renderSidebar();
}
// Admin menolak seluruh pengajuan peminjaman dalam satu paket event, dengan alasan opsional.
function rejectEventLoan(eventId) {
    const db = getDB();
    const items = db.loans.filter(l => l.eventId === eventId && l.status === 'menunggu_admin');
    if (!items.length) return;
    const reason = prompt('Alasan penolakan (opsional):', '') || '';
    items.forEach(loan => {
        loan.status = 'ditolak';
        loan.rejectedBy = currentUser().name;
        loan.rejectedDate = todayStr();
        loan.rejectReason = reason.trim();
    });
    saveDB(db);
    toast('Pengajuan peminjaman event ditolak (seluruh barang).', 'warning');
    renderPage('loans');
    renderSidebar();
}
// Form pengembalian event: setiap barang bisa punya kondisi berbeda-beda
// (baik/rusak/mt/hilang/habis pakai), tapi diajukan sebagai satu paket.
// Alur sama seperti pengembalian biasa: Admin dulu (tahap 1), lalu Manajemen (tahap 2)
// untuk barang yang kondisinya bermasalah.
function openEventReturnForm(eventId) {
    const db = getDB();
    const items = db.loans.filter(l => l.eventId === eventId && l.status === 'dipinjam');
    if (!items.length) return;
    const first = items[0];
    // Tiap barang punya daftar kendalanya sendiri; opsi "Habis" hanya untuk barang ATK/habis pakai.
    items.forEach(l => {
        const it = db.items.find(i => i.id === l.itemId);
        initKendalaDraft(l.id, !!(it && it.isConsumable));
    });
    const rowsHtml = items.map(l => `
        <div class="kendala-item-block">
            <div class="kendala-item-head">
                ${escapeHtml(l.itemName)}
                <span class="text-muted">&middot; dikembalikan: ${l.qty} unit</span>
            </div>
            ${kendalaFieldHtml(l.id, l.qty)}
            <div class="form-group"><label>Lokasi Terakhir Terlihat (opsional)</label>
                <input type="text" id="evret-loc-${l.id}">
            </div>
        </div>`).join('');
    openModal(`Proses Pengembalian Event: ${first.eventName}`, `
        <form id="event-return-form" onsubmit="submitEventReturnForm(event, '${eventId}')">
            <p class="text-muted" style="margin-bottom:8px;">Tambahkan kendala untuk masing-masing barang bila ada. Barang tanpa kendala dianggap kembali dalam kondisi baik.</p>
            ${rowsHtml}
            <div class="form-group" style="margin-top:12px;"><label>Catatan Pengembalian Umum (opsional)</label><textarea id="evret-notes"></textarea></div>
            <p class="text-muted" style="margin-bottom:12px;">Barang tanpa kendala cukup persetujuan Admin. Barang yang punya kendala perlu persetujuan Admin lalu Manajemen.</p>
            <button type="submit" class="btn btn-primary">Ajukan Pengembalian Event</button>
        </form>
    `);
    items.forEach(l => renderKendalaRows(l.id, l.qty));
}
// Mengajukan pengembalian satu paket event sebagai PENGAJUAN (belum final), dengan kondisi
// yang bisa berbeda-beda untuk tiap barang di dalam paket tersebut.
// Mengajukan pengembalian satu paket event sebagai PENGAJUAN (belum final). Setiap barang
// dalam paket bisa punya kombinasi kendala yang berbeda-beda.
function submitEventReturnForm(e, eventId) {
    e.preventDefault();
    const db = getDB();
    const items = db.loans.filter(l => l.eventId === eventId && l.status === 'dipinjam');
    if (!items.length) return;
    const notes = document.getElementById('evret-notes').value.trim();
    // Validasi seluruh barang dulu, supaya tidak ada yang tersimpan sebagian saat ada yang gagal.
    const hasil = {};
    for (const loan of items) {
        const res = validateKendalaDraft(loan.id, loan.qty, loan.itemName);
        if (!res.ok) { toast(res.msg, 'danger'); return; }
        hasil[loan.id] = res;
    }
    let totalKendala = 0;
    items.forEach(loan => {
        const res = hasil[loan.id];
        const loc = document.getElementById(`evret-loc-${loan.id}`);
        totalKendala += res.issues.length;
        loan.status = 'menunggu_admin_pengembalian';
        loan.pendingIssues = res.issues;
        loan.pendingCondition = conditionFromIssues(res.issues);
        loan.pendingChronology = kendalaChronologyText(res.issues);
        loan.pendingLastLocation = loc ? loc.value.trim() : '';
        loan.pendingReturnNotes = notes;
        loan.returnSubmittedBy = currentUser().name;
        loan.returnSubmittedDate = todayStr();
        delete loan.pendingQtyRecovered; delete loan.pendingPhoto;
    });
    if (!saveDB(db)) return;
    closeModal();
    toast(totalKendala
        ? `Pengembalian event diajukan dengan ${totalKendala} kendala, menunggu persetujuan Admin.`
        : 'Pengembalian event diajukan, menunggu persetujuan Admin.', 'warning');
    returnTab = 'persetujuan';
    navigateTo('returns');
}
// Admin memeriksa pengembalian event (tahap 1): barang "Baik" langsung final, sisanya diteruskan ke Manajemen.
function approveEventReturnAdmin(eventId) {
    const db = getDB();
    const items = db.loans.filter(l => l.eventId === eventId && l.status === 'menunggu_admin_pengembalian');
    if (!items.length) return;
    items.forEach(loan => {
        const tanpaKendala = Array.isArray(loan.pendingIssues)
            ? loan.pendingIssues.length === 0
            : loan.pendingCondition === 'baik';
        if (tanpaKendala) {
            const item = db.items.find(i => i.id === loan.itemId);
            if (item) item.stock += loan.qty;
            loan.status = 'dikembalikan';
            loan.returnDate = todayStr();
            loan.condition = 'baik';
            loan.issues = [];
            loan.returnNotes = loan.pendingReturnNotes || '';
            loan.processedBy = loan.returnSubmittedBy;
            loan.returnApprovedBy = currentUser().name;
            loan.adminReturnApprovedBy = currentUser().name;
            clearPendingReturnFields(loan);
        } else {
            loan.status = 'menunggu_manajemen_pengembalian';
            loan.adminReturnApprovedBy = currentUser().name;
            loan.adminReturnApprovedDate = todayStr();
        }
    });
    saveDB(db);
    toast(`Pengembalian event "${items[0].eventName}" diperiksa Admin. Barang bermasalah diteruskan ke Manajemen.`, 'warning');
    renderPage('returns');
    renderSidebar();
}
// Admin menolak pengembalian event (tahap 1) -> semua barang kembali berstatus Sedang Dipinjam.
function rejectEventReturnAdmin(eventId) {
    const db = getDB();
    const items = db.loans.filter(l => l.eventId === eventId && l.status === 'menunggu_admin_pengembalian');
    if (!items.length) return;
    if (!confirm('Tolak pengajuan pengembalian event ini? Semua barang akan kembali berstatus Sedang Dipinjam.')) return;
    items.forEach(loan => {
        loan.status = 'dipinjam';
        clearPendingReturnFields(loan);
        delete loan.returnSubmittedBy; delete loan.returnSubmittedDate;
    });
    saveDB(db);
    toast('Pengajuan pengembalian event ditolak Admin, kembali ke status Sedang Dipinjam.', 'warning');
    renderPage('returns');
    renderSidebar();
}
// Manajemen menyetujui pengembalian event (tahap 2, final) -> barang bermasalah yang tersisa diproses.
function approveEventReturnManajemen(eventId) {
    const db = getDB();
    const items = db.loans.filter(l => l.eventId === eventId && l.status === 'menunggu_manajemen_pengembalian');
    if (!items.length) return;
    items.forEach(loan => {
        const condition = loan.pendingCondition;
        loan.status = 'dikembalikan';
        loan.returnDate = todayStr();
        loan.condition = condition;
        if (Array.isArray(loan.pendingIssues)) loan.issues = loan.pendingIssues.map(k => Object.assign({}, k));
        loan.returnNotes = loan.pendingReturnNotes || '';
        loan.processedBy = loan.returnSubmittedBy;
        loan.returnApprovedBy = currentUser().name;
        finalizeProblemReturn(db, loan, condition);
        clearPendingReturnFields(loan);
    });
    saveDB(db);
    toast(`Pengembalian event "${items[0].eventName}" disetujui Manajemen & seluruh barang diproses.`);
    renderPage('returns');
    renderSidebar();
}
// Manajemen menolak pengembalian event (tahap 2) -> semua barang kembali berstatus Sedang Dipinjam.
function rejectEventReturnManajemen(eventId) {
    const db = getDB();
    const items = db.loans.filter(l => l.eventId === eventId && l.status === 'menunggu_manajemen_pengembalian');
    if (!items.length) return;
    if (!confirm('Tolak pengajuan pengembalian event ini? Semua barang akan kembali berstatus Sedang Dipinjam.')) return;
    items.forEach(loan => {
        loan.status = 'dipinjam';
        clearPendingReturnFields(loan);
        delete loan.returnSubmittedBy; delete loan.returnSubmittedDate; delete loan.adminReturnApprovedBy; delete loan.adminReturnApprovedDate;
    });
    saveDB(db);
    toast('Pengajuan pengembalian event ditolak Manajemen, kembali ke status Sedang Dipinjam.', 'warning');
    renderPage('returns');
    renderSidebar();
}

/* =========================================================
   PEMBELIAN BARANG BARU (stok masuk + invoice foto)
   ========================================================= */
function renderPurchasesPage() {
    if (!hasRole('admin', 'manajemen')) return `<p class="text-muted">Anda tidak memiliki akses ke halaman ini.</p>`;
    const db = getDB();
    const rows = [...db.purchases].sort((a, b) => new Date(b.date) - new Date(a.date));
    return `
    <div class="page-header">
        <p>Catat pembelian barang baru untuk menambah stok, lengkap dengan foto invoice.</p>
        <button class="btn btn-primary" onclick="openPurchaseForm()"><i data-lucide="plus"></i>Catat Pembelian</button>
    </div>
    <div class="table-container">
        <table class="data-table">
            <thead><tr><th>Tanggal</th><th>Barang</th><th>Jml</th><th>Harga Satuan</th><th>Total</th><th>Supplier</th><th>Invoice</th></tr></thead>
            <tbody>
                ${rows.length ? rows.map(p => `<tr>
                    <td>${fmtDate(p.date)}</td><td>${escapeHtml(p.itemName)}</td><td>${p.qty}</td>
                    <td>${fmtRupiah(p.price)}</td><td>${fmtRupiah(p.price * p.qty)}</td><td>${escapeHtml(p.supplier || '-')}</td>
                    <td>${p.invoicePhoto ? `<img src="${p.invoicePhoto}" class="thumb" onclick="viewInvoice('${p.id}')" title="Lihat invoice">` : '-'}</td>
                </tr>`).join('') : `<tr class="empty-row"><td colspan="7">Belum ada data pembelian.</td></tr>`}
            </tbody>
        </table>
    </div>`;
}
// Membuka form catat pembelian baru: bisa memilih barang yang sudah ada atau membuat barang baru sekaligus.
function openPurchaseForm() {
    const db = getDB();
    pendingInvoiceData = null;
    const options = db.items.map(i => `<option value="${i.id}">${escapeHtml(i.name)}</option>`).join('');
    openModal('Catat Pembelian Barang Baru', `
        <form id="purchase-form" onsubmit="submitPurchaseForm(event)">
            <div class="form-group"><label>Barang</label>
                <select id="p-item" required>
                    <option value="__new__">+ Barang baru (belum ada di data)</option>
                    ${options}
                </select>
            </div>
            <div class="form-group hidden" id="p-newitem-group">
                <div class="form-row">
                    <div class="form-group"><label>Nama Barang Baru</label><input type="text" id="p-newname"></div>
                    <div class="form-group"><label>Kategori</label><input type="text" id="p-newcategory" placeholder="cth: Alat Kerja"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Satuan</label><input type="text" id="p-newunit" value="pcs"></div>
                    <div class="form-group"><label>Stok Minimum</label><input type="number" id="p-newminstock" min="0" value="1"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Lokasi</label><input type="text" id="p-newlocation" placeholder="cth: Gudang Utama"></div>
                    <div class="form-group"><label>Rak</label><input type="text" id="p-newrack" placeholder="cth: 1"></div>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Jumlah</label><input type="number" id="p-qty" min="1" value="1" required></div>
                <div class="form-group"><label>Harga Satuan (Rp)</label><input type="number" id="p-price" min="0" value="0" required></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Supplier</label><input type="text" id="p-supplier"></div>
                <div class="form-group"><label>Tanggal</label><input type="date" id="p-date" value="${todayStr()}" required></div>
            </div>
            <div class="form-group"><label>Foto Invoice</label>
                <div style="display:flex;gap:8px;">
                    <div class="upload-box" style="flex:1;" onclick="document.getElementById('p-invoice-file').click()">
                        <i data-lucide="upload"></i><div>Unggah dari galeri</div>
                    </div>
                    <div class="upload-box" style="flex:1;" onclick="capturePurchaseInvoicePhoto()">
                        <i data-lucide="camera"></i><div>Ambil foto langsung</div>
                    </div>
                </div>
                <input type="file" id="p-invoice-file" accept="image/*" class="hidden" onchange="previewInvoice(event)">
                <img id="p-invoice-preview" class="upload-preview hidden">
            </div>
            <button type="submit" class="btn btn-primary btn-block">Simpan & Update Stok</button>
        </form>
    `);
    document.getElementById('p-item').addEventListener('change', function () {
        document.getElementById('p-newitem-group').classList.toggle('hidden', this.value !== '__new__');
    });
}
let pendingInvoiceData = null; // menampung data URL foto invoice yang baru diunggah, sebelum disimpan ke database
// Mengambil foto invoice langsung dari kamera (berwatermark tanggal/waktu/lokasi).
function capturePurchaseInvoicePhoto() {
    openCameraCapture((dataUrl) => {
        pendingInvoiceData = dataUrl;
        const img = document.getElementById('p-invoice-preview');
        if (img) { img.src = dataUrl; img.classList.remove('hidden'); }
    }, 'Ambil Foto Invoice');
}
// Membaca file foto invoice yang dipilih pengguna dan menampilkan pratinjaunya (data URL) sebelum disimpan.
function previewInvoice(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
        pendingInvoiceData = ev.target.result;
        const img = document.getElementById('p-invoice-preview');
        img.src = pendingInvoiceData;
        img.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}
// Menyimpan catatan pembelian, menambah stok barang (baru dibuat atau yang sudah ada),
// dan menyertakan foto invoice bila ada.
function submitPurchaseForm(e) {
    e.preventDefault();
    const db = getDB();
    const itemSel = document.getElementById('p-item').value;
    const qty = Number(document.getElementById('p-qty').value);
    const price = Number(document.getElementById('p-price').value);
    let item;
    if (itemSel === '__new__') {
        const name = document.getElementById('p-newname').value.trim();
        if (!name) { toast('Nama barang baru wajib diisi.', 'danger'); return; }
        const category = document.getElementById('p-newcategory').value.trim();
        const unit = document.getElementById('p-newunit').value.trim() || 'pcs';
        const minStock = Number(document.getElementById('p-newminstock').value) || 1;
        const location = document.getElementById('p-newlocation').value.trim();
        const rack = document.getElementById('p-newrack').value.trim();
        item = { id: uid('itm'), name, category, stock: 0, unit, location, rack, minStock };
        db.items.push(item);
    } else {
        item = db.items.find(i => i.id === itemSel);
    }
    item.stock += qty;
    db.purchases.push({
        id: uid('pur'), itemId: item.id, itemName: item.name, qty, price,
        supplier: document.getElementById('p-supplier').value.trim(),
        date: document.getElementById('p-date').value,
        invoicePhoto: pendingInvoiceData || null,
        addedBy: currentUser().name
    });
    pendingInvoiceData = null;
    saveDB(db);
    closeModal();
    toast('Pembelian dicatat & stok barang diperbarui.');
    renderPage('purchases');
}
// Menampilkan foto invoice ukuran penuh untuk satu transaksi pembelian di dalam modal.
function viewInvoice(purchaseId) {
    const db = getDB();
    const p = db.purchases.find(x => x.id === purchaseId);
    if (!p || !p.invoicePhoto) return;
    openModal('Foto Invoice - ' + p.itemName, `<img src="${p.invoicePhoto}" style="width:100%;border-radius:8px;">`);
}

/* =========================================================
   PENGAJUAN PEMBELIAN (bisa dicetak / print untuk atasan)
   ========================================================= */
function renderRequestsPage() {
    const db = getDB();
    const isManagerLevel = hasRole('admin', 'manajemen');
    const list = isManagerLevel ? db.requests : db.requests.filter(r => r.requestedBy === currentUser().name);
    const rows = [...list].sort((a, b) => new Date(b.date) - new Date(a.date));
    return `
    <div class="page-header">
        <p>Ajukan permintaan pembelian barang. ${hasRole('manajemen') ? 'Sebagai Manajemen, Anda dapat menyetujui/menolak pengajuan.' : ''}</p>
        <button class="btn btn-primary" onclick="openRequestForm()"><i data-lucide="plus"></i>Buat Pengajuan</button>
    </div>
    <div class="table-container">
        <table class="data-table">
            <thead><tr><th>No. Pengajuan</th><th>Tanggal</th><th>Barang</th><th>Jml</th><th>Diajukan Oleh</th><th>Status</th><th>Lampiran</th><th>Aksi</th></tr></thead>
            <tbody>
                ${rows.length ? rows.map(r => `<tr>
                    <td>${escapeHtml(r.customNo || r.id)}</td>
                    <td>${fmtDate(r.date)}</td><td>${escapeHtml(r.itemName)}${r.itemCode ? ` <span class="text-muted">(${escapeHtml(r.itemCode)})</span>` : ''}</td><td>${r.qty}</td>
                    <td>${escapeHtml(r.requestedBy)}</td><td>${requestStatusBadge(r.status)}</td>
                    <td>${r.attachments && r.attachments.length
                        ? `<button class="btn-icon" title="Lihat Lampiran" onclick="viewRequestAttachments('${r.id}')"><i data-lucide="paperclip"></i>${r.attachments.length}</button>`
                        : '-'}</td>
                    <td class="actions">
                        ${hasRole('manajemen') && r.status === 'pending' ? `
                            <button class="btn-icon" title="Setujui" onclick="updateRequestStatus('${r.id}','disetujui')"><i data-lucide="check"></i></button>
                            <button class="btn-icon text-danger" title="Tolak" onclick="updateRequestStatus('${r.id}','ditolak')"><i data-lucide="x"></i></button>
                        ` : ''}
                        <button class="btn-icon" title="Cetak Form Pengajuan" onclick="printRequest('${r.id}')"><i data-lucide="printer"></i></button>
                    </td>
                </tr>`).join('') : `<tr class="empty-row"><td colspan="8">Belum ada pengajuan.</td></tr>`}
            </tbody>
        </table>
    </div>`;
}
// Memetakan status pengajuan pembelian menjadi label badge berwarna.
function requestStatusBadge(status) {
    if (status === 'disetujui') return '<span class="badge badge-success">Disetujui</span>';
    if (status === 'ditolak') return '<span class="badge badge-danger">Ditolak</span>';
    return '<span class="badge badge-warning">Menunggu</span>';
}
// Membuka form untuk membuat pengajuan pembelian baru.
function openRequestForm() {
    openModal('Buat Pengajuan Pembelian', `
        <form id="request-form" onsubmit="submitRequestForm(event)">
            <div class="form-row">
                <div class="form-group"><label>No. Pengajuan (opsional, kustom)</label><input type="text" id="r-customno" placeholder="kosongkan untuk otomatis"></div>
                <div class="form-group"><label>Kode Barang (opsional, kustom)</label><input type="text" id="r-itemcode" placeholder="cth: ES0010"></div>
            </div>
            <div class="form-group"><label>Nama Barang</label><input type="text" id="r-name" required></div>
            <div class="form-row">
                <div class="form-group"><label>Jumlah</label><input type="number" id="r-qty" min="1" value="1" required></div>
                <div class="form-group"><label>Perkiraan Harga (Rp, opsional)</label><input type="number" id="r-price" min="0" value="0"></div>
            </div>
            <div class="form-group"><label>Alasan / Keterangan</label><textarea id="r-reason" placeholder="cth: stok habis, kebutuhan proyek X" required></textarea></div>
            <div class="form-group">
                <label>Foto/Dokumen Pendukung (opsional, maks ${ATTACHMENT_MAX_COUNT} file, @${fmtFileSize(ATTACHMENT_MAX_SIZE)} per file)</label>
                <div style="display:flex;gap:8px;">
                    <div class="upload-box" style="flex:1;" onclick="document.getElementById('r-attachment-input').click()">
                        <i data-lucide="upload"></i><div>Unggah file (PNG/JPG/WebP/PDF)</div>
                    </div>
                    <div class="upload-box" style="flex:1;" onclick="openCameraCapture(addCapturedPhotoToRequest, 'Ambil Foto Barang / Penawaran')">
                        <i data-lucide="camera"></i><div>Ambil foto langsung</div>
                    </div>
                </div>
                <input type="file" id="r-attachment-input" class="hidden" multiple
                       accept="image/png,image/jpeg,image/webp,application/pdf"
                       onchange="onRequestFilesSelected(event)">
                <div id="r-attachment-preview" class="attachment-grid"></div>
            </div>
            <button type="submit" class="btn btn-primary btn-block">Ajukan</button>
        </form>
    `);
    pendingRequestAttachments = [];
    renderRequestAttachmentPreview();
}
let pendingRequestAttachments = []; // menampung lampiran yang sedang di-compose, sebelum pengajuan disubmit
// Dipanggil saat user memilih file baru dari input multiple pada form pengajuan.
function onRequestFilesSelected(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // supaya bisa pilih file yang sama lagi kalau perlu
    for (const file of files) {
        if (pendingRequestAttachments.length >= ATTACHMENT_MAX_COUNT) {
            toast(`Maksimal ${ATTACHMENT_MAX_COUNT} lampiran per pengajuan.`, 'warning');
            break;
        }
        addValidatedAttachment(file, null);
    }
}
// Validasi 1 file lalu (jika lolos) membaca & menambah/mengganti entri di pendingRequestAttachments.
// replaceId: jika diisi, entri dengan id tsb akan diganti; jika null, ditambah sebagai entri baru.
function addValidatedAttachment(file, replaceId) {
    if (!ATTACHMENT_ALLOWED_TYPES.includes(file.type)) {
        toast(`Format "${file.name}" tidak didukung. Gunakan PNG, JPG, WebP, atau PDF.`, 'danger');
        return;
    }
    if (file.size > ATTACHMENT_MAX_SIZE) {
        toast(`"${file.name}" melebihi batas ${fmtFileSize(ATTACHMENT_MAX_SIZE)}.`, 'danger');
        return;
    }
    const reader = new FileReader();
    reader.onload = function (ev) {
        const entry = { id: replaceId || uid('att'), name: file.name, type: file.type, size: file.size, dataUrl: ev.target.result };
        if (replaceId) {
            const idx = pendingRequestAttachments.findIndex(a => a.id === replaceId);
            if (idx > -1) pendingRequestAttachments[idx] = entry;
        } else {
            pendingRequestAttachments.push(entry);
        }
        renderRequestAttachmentPreview();
    };
    reader.readAsDataURL(file);
}
// Merender grid thumbnail lampiran yang sedang di-compose (belum disubmit), lengkap
// tombol Ganti & Hapus per item.
function renderRequestAttachmentPreview() {
    const wrap = document.getElementById('r-attachment-preview');
    if (!wrap) return;
    wrap.innerHTML = pendingRequestAttachments.map(a => `
        <div class="attachment-item">
            ${isImageAttachment(a.type)
                ? `<img src="${a.dataUrl}" onclick="openAttachmentLightbox('${a.dataUrl}','${escapeHtml(a.name)}','${a.type}')">`
                : `<div class="file-badge" onclick="openAttachmentLightbox('${a.dataUrl}','${escapeHtml(a.name)}','${a.type}')"><i data-lucide="file-text"></i>${escapeHtml(a.name)}</div>`}
            <button type="button" class="attachment-remove" title="Hapus" onclick="removeRequestAttachment('${a.id}')">&times;</button>
            <div class="attachment-replace" onclick="triggerReplaceAttachment('${a.id}')">Ganti</div>
        </div>`).join('');
    if (window.lucide) lucide.createIcons();
}
// Menghapus 1 lampiran dari daftar yang sedang di-compose.
function removeRequestAttachment(attId) {
    pendingRequestAttachments = pendingRequestAttachments.filter(a => a.id !== attId);
    renderRequestAttachmentPreview();
}
// Membuka file picker untuk mengganti 1 lampiran tertentu (dipakai tombol "Ganti").
function triggerReplaceAttachment(attId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp,application/pdf';
    input.onchange = (e) => { if (e.target.files[0]) addValidatedAttachment(e.target.files[0], attId); };
    input.click();
}
// Lightbox sederhana: gambar ditampilkan penuh di dalam modal; PDF dibuka di tab baru karena
// data URL PDF tidak selalu tampil bagus di dalam modal kecil.
function openAttachmentLightbox(dataUrl, name, type) {
    if (type === 'application/pdf') { window.open(dataUrl, '_blank'); return; }
    openModal(name, `<img src="${dataUrl}" style="width:100%;border-radius:8px;">`);
}
// Menampilkan semua lampiran sebuah pengajuan yang sudah tersimpan, dalam modal read-only
// (tanpa opsi hapus/ganti - itu hanya tersedia saat compose sebelum submit).
function viewRequestAttachments(reqId) {
    const db = getDB();
    const r = db.requests.find(x => x.id === reqId);
    if (!r || !r.attachments || !r.attachments.length) return;
    const grid = r.attachments.map(a => `
        <div class="attachment-item" style="width:110px;height:110px;">
            ${isImageAttachment(a.type)
                ? `<img src="${a.dataUrl}" onclick="openAttachmentLightbox('${a.dataUrl}','${escapeHtml(a.name)}','${a.type}')">`
                : `<div class="file-badge" onclick="openAttachmentLightbox('${a.dataUrl}','${escapeHtml(a.name)}','${a.type}')"><i data-lucide="file-text"></i>${escapeHtml(a.name)}</div>`}
        </div>`).join('');
    openModal('Lampiran - ' + (r.customNo || r.id), `<div class="attachment-grid">${grid}</div>`);
    if (window.lucide) lucide.createIcons();
}
// Menyimpan pengajuan pembelian baru dengan status 'pending'.
function submitRequestForm(e) {
    e.preventDefault();
    const db = getDB();
    db.requests.push({
        id: uid('req'),
        customNo: document.getElementById('r-customno').value.trim(),
        itemCode: document.getElementById('r-itemcode').value.trim(),
        itemName: document.getElementById('r-name').value.trim(),
        qty: Number(document.getElementById('r-qty').value),
        estPrice: Number(document.getElementById('r-price').value) || 0,
        reason: document.getElementById('r-reason').value.trim(),
        attachments: pendingRequestAttachments,
        requestedBy: currentUser().name, date: todayStr(), status: 'pending'
    });
    pendingRequestAttachments = [];
    saveDB(db);
    closeModal();
    toast('Pengajuan pembelian berhasil dikirim.');
    renderPage('requests');
    renderSidebar();
}
// Manajemen menyetujui atau menolak sebuah pengajuan pembelian.
function updateRequestStatus(reqId, status) {
    const db = getDB();
    const r = db.requests.find(x => x.id === reqId);
    r.status = status;
    r.approvedBy = currentUser().name;
    r.decisionDate = todayStr();
    saveDB(db);
    toast(status === 'disetujui' ? 'Pengajuan disetujui.' : 'Pengajuan ditolak.', status === 'disetujui' ? 'success' : 'warning');
    renderPage('requests');
    renderSidebar();
}
// Cetak form pengajuan pembelian untuk diajukan ke level lebih atas
function printRequest(reqId) {
    const db = getDB();
    const r = db.requests.find(x => x.id === reqId);
    if (!r) return;
    const html = `
        <div style="text-align:center;margin-bottom:24px;">
            <h2 style="margin-bottom:4px;">FORM PENGAJUAN PEMBELIAN BARANG</h2>
            <p style="color:#555;">GudangKita - Sistem Manajemen Stok & Peminjaman</p>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
            <tr><td style="padding:6px 0;width:200px;"><strong>No. Pengajuan</strong></td><td>: ${escapeHtml(r.customNo || r.id)}</td></tr>
            <tr><td style="padding:6px 0;"><strong>Tanggal Pengajuan</strong></td><td>: ${fmtDate(r.date)}</td></tr>
            <tr><td style="padding:6px 0;"><strong>Diajukan Oleh</strong></td><td>: ${escapeHtml(r.requestedBy)}</td></tr>
            ${r.itemCode ? `<tr><td style="padding:6px 0;"><strong>Kode Barang</strong></td><td>: ${escapeHtml(r.itemCode)}</td></tr>` : ''}
            <tr><td style="padding:6px 0;"><strong>Nama Barang</strong></td><td>: ${escapeHtml(r.itemName)}</td></tr>
            <tr><td style="padding:6px 0;"><strong>Jumlah</strong></td><td>: ${r.qty}</td></tr>
            <tr><td style="padding:6px 0;"><strong>Perkiraan Harga</strong></td><td>: ${r.estPrice ? fmtRupiah(r.estPrice) : '-'}</td></tr>
            <tr><td style="padding:6px 0;vertical-align:top;"><strong>Alasan / Keterangan</strong></td><td>: ${escapeHtml(r.reason)}</td></tr>
            <tr><td style="padding:6px 0;"><strong>Status</strong></td><td>: ${r.status === 'disetujui' ? 'DISETUJUI' : r.status === 'ditolak' ? 'DITOLAK' : 'MENUNGGU PERSETUJUAN'}</td></tr>
            ${r.approvedBy ? `<tr><td style="padding:6px 0;"><strong>Diputuskan Oleh</strong></td><td>: ${escapeHtml(r.approvedBy)} (${fmtDate(r.decisionDate)})</td></tr>` : ''}
        </table>
        ${r.attachments && r.attachments.length ? `
        <div style="margin:20px 0;">
            <p><strong>Lampiran Pendukung:</strong></p>
            ${r.attachments.map(a => isImageAttachment(a.type)
                ? `<img src="${a.dataUrl}" style="max-width:300px;max-height:220px;border:1px solid #000;margin:6px 10px 6px 0;">`
                : `<p style="margin:4px 0;">&#128206; ${escapeHtml(a.name)} <span style="color:#777;">(dokumen PDF, lihat file terpisah)</span></p>`
            ).join('')}
        </div>` : ''}
        <table style="width:100%;margin-top:60px;border-collapse:collapse;">
            <tr>
                <td style="width:33%;text-align:center;">Diajukan oleh,<br><br><br><br>(...........................)</td>
                <td style="width:33%;text-align:center;">Diperiksa Admin,<br><br><br><br>(...........................)</td>
                <td style="width:33%;text-align:center;">Disetujui Manajemen,<br><br><br><br>(...........................)</td>
            </tr>
        </table>
    `;
    document.getElementById('print-area').innerHTML = html;
    window.print();
}

/* =========================================================
   BARANG RUSAK / MT
   ========================================================= */
function renderDamagesPage() {
    if (!hasRole('admin', 'manajemen')) return `<p class="text-muted">Anda tidak memiliki akses ke halaman ini.</p>`;
    const db = getDB();
    const rows = [...db.damages].sort((a, b) => new Date(b.date) - new Date(a.date));
    // Jumlah barang yang sedang berstatus "Perlu Maintenance (MT)" dan belum selesai/permanen (masih dalam masa maintenance).
    const mtQty = db.damages
        .filter(d => d.type === 'mt' && d.status !== 'selesai' && d.status !== 'permanen' && d.status !== 'hilang_permanen')
        .reduce((sum, d) => sum + Number(d.qty || 0), 0);
    return `
    <div class="page-header">
        <p>Catatan barang rusak / perlu maintenance, baik dari pengembalian pinjaman maupun laporan langsung.</p>
        <button class="btn btn-primary" onclick="openDamageForm()"><i data-lucide="plus"></i>Catat Barang Rusak/MT</button>
    </div>
    <div class="card-grid">
        <div class="stat-card">
            <div class="stat-icon warning"><i data-lucide="wrench"></i></div>
            <div><div class="stat-value">${mtQty}</div><div class="stat-label">Jumlah Barang Dalam Maintenance</div></div>
        </div>
    </div>
    <div class="table-container">
        <table class="data-table">
            <thead><tr><th>Tanggal</th><th>Barang</th><th>Jml</th><th>Jenis</th><th>Kronologi</th><th>Lokasi Terakhir</th><th>Sumber</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
                ${rows.length ? rows.map(d => `<tr>
                    <td>${fmtDate(d.date)}</td><td>${escapeHtml(d.itemName)}</td><td>${d.qty}</td>
                    <td>${d.type === 'mt' ? '<span class="badge badge-warning">MT</span>' : '<span class="badge badge-danger">Rusak</span>'}</td>
                    <td>${escapeHtml(d.description || '-')}</td>
                    <td>${escapeHtml(d.lastLocation || '-')}</td>
                    <td>${d.source === 'pengembalian' ? 'Pengembalian' : 'Laporan Langsung'}</td>
                    <td>${damageStatusBadge(d.status)}</td>
                    <td>
                        ${(d.status !== 'selesai' && d.status !== 'permanen' && d.status !== 'hilang_permanen') ? `<select onchange="updateDamageStatus('${d.id}', this.value)" class="btn-sm">
                            <option value="">Ubah status...</option>
                            <option value="proses">Sedang Diproses</option>
                            <option value="selesai">Selesai Diperbaiki (kembali ke stok)</option>
                            <option value="hilang_permanen">Ternyata Benar-benar Hilang</option>
                        </select>` : '-'}
                    </td>
                </tr>`).join('') : `<tr class="empty-row"><td colspan="9">Belum ada catatan barang rusak/MT.</td></tr>`}
            </tbody>
        </table>
    </div>`;
}
// Memetakan status catatan barang rusak/MT menjadi label badge berwarna.
function damageStatusBadge(s) {
    if (s === 'selesai') return '<span class="badge badge-success">Selesai Diperbaiki</span>';
    if (s === 'proses') return '<span class="badge badge-info">Diproses</span>';
    if (s === 'permanen') return '<span class="badge badge-danger">Rusak Permanen</span>';
    if (s === 'hilang_permanen') return '<span class="badge badge-danger">Benar-benar Hilang</span>';
    return '<span class="badge badge-warning">Menunggu</span>';
}
// Membuka form untuk mencatat langsung barang yang rusak/perlu maintenance (di luar proses pengembalian pinjaman).
function openDamageForm() {
    const db = getDB();
    const options = db.items.map(i => `<option value="${i.id}">${escapeHtml(i.name)}</option>`).join('');
    openModal('Catat Barang Rusak / MT', `
        <form id="damage-form" onsubmit="submitDamageForm(event)">
            <div class="form-group"><label>Barang</label><select id="d-item" required>${options}</select></div>
            <div class="form-row">
                <div class="form-group"><label>Jumlah</label><input type="number" id="d-qty" min="1" value="1" required></div>
                <div class="form-group"><label>Jenis</label>
                    <select id="d-type" required><option value="rusak">Rusak</option><option value="mt">Perlu Maintenance (MT)</option></select>
                </div>
            </div>
            <div class="form-group"><label>Kronologi Kerusakan</label><textarea id="d-desc" required></textarea></div>
            <div class="form-group"><label>Lokasi Terakhir Terlihat (opsional)</label><input type="text" id="d-location"></div>
            <button type="submit" class="btn btn-primary btn-block">Simpan Catatan</button>
        </form>
    `);
}
// Menyimpan laporan rusak/MT langsung dan memindahkan jumlah barang tersebut dari stok baik ke catatan rusak/MT.
function submitDamageForm(e) {
    e.preventDefault();
    const db = getDB();
    const item = db.items.find(i => i.id === document.getElementById('d-item').value);
    const qty = Number(document.getElementById('d-qty').value);
    if (item && item.stock >= qty) item.stock -= qty; // pindahkan dari stok baik ke catatan rusak/MT
    db.damages.push({
        id: uid('dmg'), itemId: item.id, itemName: item.name, qty,
        type: document.getElementById('d-type').value,
        description: document.getElementById('d-desc').value.trim(),
        lastLocation: document.getElementById('d-location').value.trim(),
        source: 'laporan langsung', reportedBy: currentUser().name, date: todayStr(), status: 'menunggu'
    });
    saveDB(db);
    closeModal();
    toast('Catatan barang rusak/MT disimpan.', 'warning');
    renderPage('damages');
}
// Memperbarui status penanganan sebuah catatan barang rusak/MT (menunggu/diproses/selesai/hilang_permanen).
// "Selesai Diperbaiki" -> jumlah barang dikembalikan ke stok. "Ternyata Benar-benar Hilang" -> dipindah ke modul Barang Hilang.
function updateDamageStatus(id, status) {
    if (!status) return;
    const db = getDB();
    const d = db.damages.find(x => x.id === id);
    if (status === 'selesai') {
        const item = db.items.find(i => i.id === d.itemId);
        if (item) item.stock += d.qty;
    } else if (status === 'hilang_permanen') {
        db.lost.push({
            id: uid('lost'), itemId: d.itemId, itemName: d.itemName, qty: d.qty,
            lastLocation: d.lastLocation || '', description: d.description || '',
            source: 'barang rusak/mt', date: todayStr(), reportedBy: currentUser().name, status: 'writeoff'
        });
    }
    d.status = status;
    saveDB(db);
    renderPage('damages');
    toast('Status diperbarui.');
}

/* =========================================================
   BARANG HILANG (identifikasi)
   ========================================================= */
function renderLostPage() {
    if (!hasRole('admin', 'manajemen')) return `<p class="text-muted">Anda tidak memiliki akses ke halaman ini.</p>`;
    const db = getDB();
    const rows = [...db.lost].sort((a, b) => new Date(b.date) - new Date(a.date));
    // Jumlah barang hilang yang statusnya sudah "Ditemukan" (berhasil ditemukan kembali).
    const foundQty = db.lost
        .filter(l => l.status === 'ditemukan')
        .reduce((sum, l) => sum + Number(l.qty || 0), 0);
    return `
    <div class="page-header">
        <p>Identifikasi dan catat barang yang hilang dari gudang.</p>
        <button class="btn btn-primary" onclick="openLostForm()"><i data-lucide="plus"></i>Laporkan Barang Hilang</button>
    </div>
    <div class="card-grid">
        <div class="stat-card">
            <div class="stat-icon success"><i data-lucide="search-check"></i></div>
            <div><div class="stat-value">${foundQty}</div><div class="stat-label">Jumlah Ditemukan</div></div>
        </div>
    </div>
    <div class="table-container">
        <table class="data-table">
            <thead><tr><th>Tanggal</th><th>Barang</th><th>Jml</th><th>Jml Ditemukan</th><th>Lokasi Terakhir</th><th>Keterangan Identifikasi</th><th>Dilaporkan Oleh</th><th>Status</th></tr></thead>
            <tbody>
                ${rows.length ? rows.map(l => `<tr>
                    <td>${fmtDate(l.date)}</td><td>${escapeHtml(l.itemName)}</td><td>${l.qty}</td>
                    <td>${l.status === 'ditemukan' ? l.qty : '-'}</td>
                    <td>${escapeHtml(l.lastLocation || '-')}</td><td>${escapeHtml(l.description || '-')}</td>
                    <td>${escapeHtml(l.reportedBy)}</td>
                    <td>
                        <select onchange="updateLostStatus('${l.id}', this.value)" class="btn-sm">
                            <option value="dicari" ${l.status === 'dicari' ? 'selected' : ''}>Sedang Dicari</option>
                            <option value="ditemukan" ${l.status === 'ditemukan' ? 'selected' : ''}>Ditemukan</option>
                            <option value="writeoff" ${l.status === 'writeoff' ? 'selected' : ''}>Benar-benar Hilang (Write-off)</option>
                        </select>
                    </td>
                </tr>`).join('') : `<tr class="empty-row"><td colspan="8">Belum ada laporan barang hilang.</td></tr>`}
            </tbody>
        </table>
    </div>`;
}
// Membuka form untuk melaporkan langsung barang yang hilang (di luar proses pengembalian pinjaman).
function openLostForm() {
    const db = getDB();
    const options = db.items.map(i => `<option value="${i.id}">${escapeHtml(i.name)}</option>`).join('');
    openModal('Laporkan Barang Hilang', `
        <form id="lost-form" onsubmit="submitLostForm(event)">
            <div class="form-group"><label>Barang</label><select id="l-item" required>${options}</select></div>
            <div class="form-row">
                <div class="form-group"><label>Jumlah</label><input type="number" id="l-qty" min="1" value="1" required></div>
                <div class="form-group"><label>Lokasi Terakhir Terlihat</label><input type="text" id="l-location"></div>
            </div>
            <div class="form-group"><label>Keterangan Identifikasi</label><textarea id="l-desc" placeholder="ciri-ciri barang, dugaan penyebab hilang, dsb." required></textarea></div>
            <button type="submit" class="btn btn-primary btn-block">Simpan Laporan</button>
        </form>
    `);
}
// Menyimpan laporan barang hilang langsung dan memindahkan jumlah barang tersebut dari stok baik ke daftar barang hilang.
function submitLostForm(e) {
    e.preventDefault();
    const db = getDB();
    const item = db.items.find(i => i.id === document.getElementById('l-item').value);
    const qty = Number(document.getElementById('l-qty').value);
    if (item && item.stock >= qty) item.stock -= qty;
    db.lost.push({
        id: uid('lost'), itemId: item.id, itemName: item.name, qty,
        lastLocation: document.getElementById('l-location').value.trim(),
        description: document.getElementById('l-desc').value.trim(),
        reportedBy: currentUser().name, date: todayStr(), status: 'dicari'
    });
    saveDB(db);
    closeModal();
    toast('Laporan barang hilang disimpan.', 'warning');
    renderPage('lost');
}
// Memperbarui status pencarian sebuah barang yang hilang (dicari/ditemukan/write-off).
// Untuk "Ditemukan", jumlahnya bisa ditentukan lewat modal (bisa jadi cuma sebagian yang ketemu).
function updateLostStatus(id, status) {
    if (status === 'ditemukan') { openFoundQtyModal(id); return; }
    const db = getDB();
    const l = db.lost.find(x => x.id === id);
    l.status = status;
    saveDB(db);
    toast('Status barang hilang diperbarui.');
    renderPage('lost');
}
// Membuka modal kecil untuk menentukan berapa jumlah barang yang berhasil ditemukan (bisa sebagian dari total hilang),
// dan menentukan status sisanya (masih dicari, atau benar-benar hilang/write-off).
function openFoundQtyModal(id) {
    const db = getDB();
    const l = db.lost.find(x => x.id === id);
    if (!l) return;
    openModal(`Barang Ditemukan: ${escapeHtml(l.itemName)}`, `
        <form id="found-qty-form" onsubmit="submitFoundQty(event, '${id}')">
            <p class="text-muted" style="margin-bottom:12px;">Total yang dilaporkan hilang: <strong>${l.qty}</strong>. Masukkan berapa yang berhasil ditemukan.</p>
            <div class="form-group">
                <label>Jumlah Ditemukan</label>
                <input type="number" id="found-qty-input" min="1" max="${l.qty}" value="${l.qty}" oninput="toggleFoundRemainderField(${l.qty})" required>
            </div>
            <div class="form-group" id="found-remainder-field">
                <label>Status Sisa yang Belum Ditemukan</label>
                <select id="found-remainder-status">
                    <option value="dicari">Masih Dicari</option>
                    <option value="writeoff">Benar-benar Hilang (Write-off)</option>
                </select>
            </div>
            <button type="submit" class="btn btn-primary btn-block">Konfirmasi Ditemukan</button>
        </form>
    `);
    toggleFoundRemainderField(l.qty);
}
// Menampilkan/menyembunyikan pilihan status sisa hanya jika jumlah ditemukan masih kurang dari total yang hilang.
function toggleFoundRemainderField(totalQty) {
    const input = document.getElementById('found-qty-input');
    const field = document.getElementById('found-remainder-field');
    if (!input || !field) return;
    const found = Number(input.value) || 0;
    field.classList.toggle('hidden', found >= totalQty);
}
// Memproses konfirmasi jumlah ditemukan: kembalikan jumlah tsb ke stok. Sisa yang belum ditemukan (jika ada)
// dicatat sesuai pilihan: tetap "Sedang Dicari", atau langsung "Benar-benar Hilang (Write-off)".
function submitFoundQty(e, id) {
    e.preventDefault();
    const db = getDB();
    const l = db.lost.find(x => x.id === id);
    if (!l) return;
    let qtyFound = Number(document.getElementById('found-qty-input').value) || 0;
    qtyFound = Math.max(0, Math.min(qtyFound, l.qty));
    if (qtyFound <= 0) { closeModal(); return; }
    const item = db.items.find(i => i.id === l.itemId);
    if (item) item.stock += qtyFound;
    const qtyRemaining = l.qty - qtyFound;
    if (qtyRemaining > 0) {
        const remainderStatus = document.getElementById('found-remainder-status').value;
        l.qty = qtyRemaining; // sisanya tetap tercatat, statusnya sesuai pilihan (dicari / write-off)
        l.status = remainderStatus;
        db.lost.push({
            id: uid('lost'), itemId: l.itemId, itemName: l.itemName, qty: qtyFound,
            lastLocation: l.lastLocation, description: l.description,
            reportedBy: l.reportedBy, date: todayStr(), status: 'ditemukan'
        });
    } else {
        l.status = 'ditemukan';
    }
    saveDB(db);
    closeModal();
    toast('Barang ditemukan & stok diperbarui.');
    renderPage('lost');
}

/* =========================================================
   BARANG HABIS PAKAI / ATK
   (kondisi pemakaian bertingkat: separuh - setengah pemakaian - habis pakai;
   khusus level "habis pakai" wajib foto bukti dan perlu ACC Admin/Manajemen)
   ========================================================= */
function renderConsumablesPage() {
    const db = getDB();
    const canReport = hasRole('staff', 'admin', 'manajemen');
    const canAcc = hasRole('admin', 'manajemen');
    const rows = [...db.consumables].sort((a, b) => new Date(b.date) - new Date(a.date));
    return `
    <div class="page-header">
        <p>Catatan kondisi pemakaian barang habis pakai/ATK (cth: lakban): separuh, setengah pemakaian, hingga habis pakai.</p>
        ${canReport ? `<button class="btn btn-primary" onclick="openConsumableForm()"><i data-lucide="plus"></i>Laporkan Pemakaian</button>` : ''}
    </div>
    <div class="table-container">
        <table class="data-table">
            <thead><tr><th>Tanggal</th><th>Kode Barang</th><th>Barang</th><th>Jml</th><th>Kondisi Pemakaian</th><th>Foto</th><th>Catatan</th><th>Sumber</th><th>Status</th>${canAcc ? '<th>Aksi</th>' : ''}</tr></thead>
            <tbody>
                ${rows.length ? rows.map(c => `<tr>
                    <td>${fmtDate(c.date)}</td><td>${escapeHtml(c.itemId || '-')}</td><td>${escapeHtml(c.itemName)}</td><td>${c.qty}</td>
                    <td>${consumableLevelBadge(c.level)}</td>
                    <td>${c.photo ? `<img src="${c.photo}" class="thumb" onclick="window.open('${c.photo}')" title="Lihat foto bukti">` : '-'}</td>
                    <td>${escapeHtml(c.note || '-')}</td>
                    <td>${c.source === 'pengembalian' ? 'Pengembalian Pinjaman' : 'Laporan Langsung'}</td>
                    <td>${consumableStatusBadge(c.status)}</td>
                    ${canAcc ? `<td class="actions">
                        ${c.status === 'menunggu' ? `
                            <button class="btn btn-sm btn-success" onclick="updateConsumableStatus('${c.id}','disetujui')"><i data-lucide="check"></i>Setujui</button>
                            <button class="btn btn-sm btn-danger" onclick="updateConsumableStatus('${c.id}','ditolak')"><i data-lucide="x"></i>Tolak</button>
                        ` : '-'}
                    </td>` : ''}
                </tr>`).join('') : `<tr class="empty-row"><td colspan="${canAcc ? 10 : 9}">Belum ada catatan pemakaian.</td></tr>`}
            </tbody>
        </table>
    </div>`;
}
function consumableLevelBadge(level) {
    if (level === 'separuh') return '<span class="badge badge-info">Separuh</span>';
    if (level === 'setengah_pemakaian') return '<span class="badge badge-warning">Setengah Pemakaian</span>';
    if (level === 'habis_pakai') return '<span class="badge badge-danger">Habis Pakai</span>';
    return '-';
}
function consumableStatusBadge(status) {
    if (status === 'disetujui') return '<span class="badge badge-success">Disetujui</span>';
    if (status === 'ditolak') return '<span class="badge badge-danger">Ditolak</span>';
    if (status === 'tercatat') return '<span class="badge badge-info">Tercatat</span>';
    return '<span class="badge badge-warning">Menunggu ACC</span>';
}
let pendingConsumablePhotoData = null;
// Membuka form laporan langsung kondisi pemakaian barang habis pakai/ATK (di luar proses pengembalian pinjaman).
function openConsumableForm() {
    const db = getDB();
    const items = db.items.filter(i => i.isConsumable);
    pendingConsumablePhotoData = null;
    if (!items.length) { toast('Belum ada barang yang ditandai sebagai Barang Habis Pakai/ATK di Data Barang.', 'warning'); return; }
    const options = items.map(i => `<option value="${i.id}">[${escapeHtml(i.id)}] ${escapeHtml(i.name)}</option>`).join('');
    openModal('Laporkan Kondisi Pemakaian Barang', `
        <form id="consumable-form" onsubmit="submitConsumableForm(event)">
            <div class="form-group"><label>Barang</label><select id="c-item" required>${options}</select></div>
            <div class="form-row">
                <div class="form-group"><label>Jumlah</label><input type="number" id="c-qty" min="1" value="1" required></div>
                <div class="form-group"><label>Kondisi Pemakaian</label>
                    <select id="c-level" onchange="toggleConsumablePhoto()" required>
                        <option value="separuh">Separuh</option>
                        <option value="setengah_pemakaian">Setengah Pemakaian</option>
                        <option value="habis_pakai">Habis Pakai</option>
                    </select>
                </div>
            </div>
            <div id="c-photo-field" class="form-group">
                <label id="c-photo-label">Foto Bukti (opsional)</label>
                <div style="display:flex;gap:8px;">
                    <div class="upload-box" style="flex:1;" onclick="document.getElementById('c-photo-file').click()">
                        <i data-lucide="upload"></i><div>Unggah dari galeri</div>
                    </div>
                    <div class="upload-box" style="flex:1;" onclick="openCameraCapture((dataUrl) => {
                        pendingConsumablePhotoData = dataUrl;
                        const img = document.getElementById('c-photo-preview');
                        img.src = dataUrl; img.classList.remove('hidden');
                    }, 'Ambil Foto Bukti Pemakaian')">
                        <i data-lucide="camera"></i><div>Ambil foto langsung</div>
                    </div>
                </div>
                <input type="file" id="c-photo-file" accept="image/*" class="hidden" onchange="previewConsumablePhoto(event)">
                <img id="c-photo-preview" class="upload-preview hidden">
            </div>
            <div class="form-group"><label>Catatan (opsional)</label><textarea id="c-note"></textarea></div>
            <p class="text-muted" style="margin-bottom:12px;">Kondisi "Habis Pakai" memerlukan ACC Admin/Manajemen sebelum stok dikurangi.</p>
            <button type="submit" class="btn btn-primary btn-block">Simpan Laporan</button>
        </form>
    `);
}
// Field foto selalu tersedia (unggah galeri atau ambil foto langsung); statusnya berubah
// menjadi WAJIB ketika kondisi yang dipilih adalah "Habis Pakai".
function toggleConsumablePhoto() {
    const val = document.getElementById('c-level').value;
    const label = document.getElementById('c-photo-label');
    if (!label) return;
    label.innerHTML = val === 'habis_pakai'
        ? 'Foto Bukti <span class="text-danger">(wajib untuk Habis Pakai)</span>'
        : 'Foto Bukti (opsional)';
}
function previewConsumablePhoto(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
        pendingConsumablePhotoData = ev.target.result;
        const img = document.getElementById('c-photo-preview');
        img.src = pendingConsumablePhotoData;
        img.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}
// Menyimpan laporan langsung kondisi pemakaian. "Habis Pakai" masuk antrean ACC (belum potong stok);
// "Separuh"/"Setengah Pemakaian" langsung tercatat tanpa memotong stok.
function submitConsumableForm(e) {
    e.preventDefault();
    const db = getDB();
    const item = db.items.find(i => i.id === document.getElementById('c-item').value);
    const level = document.getElementById('c-level').value;
    if (level === 'habis_pakai' && !pendingConsumablePhotoData) { toast('Foto bukti wajib diunggah untuk kondisi Habis Pakai.', 'danger'); return; }
    db.consumables.push({
        id: uid('cons'), itemId: item.id, itemName: item.name,
        qty: Number(document.getElementById('c-qty').value),
        level, photo: pendingConsumablePhotoData || '',
        note: document.getElementById('c-note').value.trim(),
        source: 'laporan langsung', reportedBy: currentUser().name, date: todayStr(),
        status: level === 'habis_pakai' ? 'menunggu' : 'tercatat'
    });
    saveDB(db);
    closeModal();
    toast('Laporan kondisi pemakaian disimpan.', 'warning');
    renderPage('consumables');
    renderSidebar();
}
// Admin/Manajemen menyetujui atau menolak laporan "Habis Pakai" langsung. Disetujui -> stok dikurangi.
function updateConsumableStatus(id, status) {
    const db = getDB();
    const c = db.consumables.find(x => x.id === id);
    if (!c) return;
    if (status === 'disetujui') {
        const item = db.items.find(i => i.id === c.itemId);
        if (item && item.stock >= c.qty) item.stock -= c.qty;
    }
    c.status = status;
    saveDB(db);
    toast(status === 'disetujui' ? 'Disetujui, stok diperbarui.' : 'Laporan ditolak.', status === 'disetujui' ? 'success' : 'warning');
    renderPage('consumables');
}

/* =========================================================
   MANAJEMEN USER (khusus role manajemen)
   ========================================================= */
function renderUsersPage() {
    if (!hasRole('manajemen')) return `<p class="text-muted">Anda tidak memiliki akses ke halaman ini.</p>`;
    const db = getDB();
    return `
    <div class="page-header">
        <p>Kelola akun pengguna sistem (staff, admin, manajemen).</p>
        <button class="btn btn-primary" onclick="openUserForm()"><i data-lucide="plus"></i>Tambah User</button>
    </div>
    <div class="table-container">
        <table class="data-table">
            <thead><tr><th>Nama</th><th>Username</th><th>Role</th><th>Aksi</th></tr></thead>
            <tbody>
                ${db.users.map(u => `<tr>
                    <td>${escapeHtml(u.name)} ${DEFAULT_ACCOUNTS.some(d => d.id === u.id) ? '<span class="badge badge-muted">Bawaan</span>' : ''}</td><td>${escapeHtml(u.username)}</td>
                    <td>${roleBadge(u.role)}</td>
                    <td class="actions">
                        <button class="btn-icon" title="Edit" onclick="openUserForm('${u.id}')"><i data-lucide="pencil"></i></button>
                        ${u.id !== currentUser().id && !DEFAULT_ACCOUNTS.some(d => d.id === u.id) ? `<button class="btn-icon text-danger" title="Hapus" onclick="deleteUser('${u.id}')"><i data-lucide="trash-2"></i></button>` : ''}
                    </td>
                </tr>`).join('')}
            </tbody>
        </table>
    </div>`;
}
// Memetakan role pengguna menjadi label badge berwarna.
function roleBadge(role) {
    if (role === 'manajemen') return '<span class="badge badge-purple">Manajemen</span>';
    if (role === 'admin') return '<span class="badge badge-info">Admin</span>';
    return '<span class="badge badge-muted">Staff</span>';
}
// Membuka form tambah/edit akun pengguna.
function openUserForm(userId) {
    const db = getDB();
    const u = userId ? db.users.find(x => x.id === userId) : null;
    openModal(u ? 'Edit User' : 'Tambah User', `
        <form id="user-form" onsubmit="submitUserForm(event, '${userId || ''}')">
            <div class="form-group"><label>Nama Lengkap</label><input type="text" id="u-name" value="${u ? escapeHtml(u.name) : ''}" required></div>
            <div class="form-group"><label>Username</label><input type="text" id="u-username" value="${u ? escapeHtml(u.username) : ''}" required></div>
            <div class="form-group"><label>Password ${u ? '(kosongkan jika tidak diubah)' : ''}</label><input type="text" id="u-password" ${u ? '' : 'required'}></div>
            <div class="form-group"><label>Role</label>
                <select id="u-role" required>
                    <option value="staff" ${u && u.role === 'staff' ? 'selected' : ''}>Staff</option>
                    <option value="admin" ${u && u.role === 'admin' ? 'selected' : ''}>Admin</option>
                    <option value="manajemen" ${u && u.role === 'manajemen' ? 'selected' : ''}>Manajemen</option>
                </select>
            </div>
            <button type="submit" class="btn btn-primary btn-block">Simpan</button>
        </form>
    `);
}
// Menyimpan akun pengguna baru atau hasil edit, dengan pengecekan username yang sudah dipakai.
function submitUserForm(e, userId) {
    e.preventDefault();
    const db = getDB();
    const username = document.getElementById('u-username').value.trim();
    const dupe = db.users.find(u => u.username === username && u.id !== userId);
    if (dupe) { toast('Username sudah digunakan.', 'danger'); return; }
    const pass = document.getElementById('u-password').value;
    if (userId) {
        const idx = db.users.findIndex(u => u.id === userId);
        db.users[idx].name = document.getElementById('u-name').value.trim();
        db.users[idx].username = username;
        db.users[idx].role = document.getElementById('u-role').value;
        if (pass) db.users[idx].password = pass;
        toast('User berhasil diperbarui.');
    } else {
        db.users.push({
            id: uid('u'), name: document.getElementById('u-name').value.trim(),
            username, password: pass, role: document.getElementById('u-role').value
        });
        toast('User baru berhasil ditambahkan.');
    }
    saveDB(db);
    closeModal();
    renderPage('users');
}
// Menghapus akun pengguna setelah konfirmasi. Akun bawaan (default) tidak boleh dihapus,
// supaya staff/admin/manajemen selalu bisa login di device manapun.
function deleteUser(userId) {
    if (DEFAULT_ACCOUNTS.some(u => u.id === userId)) {
        toast('Akun bawaan ini tidak bisa dihapus, supaya selalu bisa login di device manapun.', 'warning');
        return;
    }
    if (!confirm('Hapus user ini?')) return;
    const db = getDB();
    db.users = db.users.filter(u => u.id !== userId);
    saveDB(db);
    renderPage('users');
    toast('User dihapus.', 'warning');
}

/* =========================================================
   KAMERA REALTIME (Ambil Foto + Watermark Tanggal/Waktu/Lokasi)
   Modul generik dipakai oleh: form ATK/Consumable, Pengembalian (habis pakai),
   dan Pengajuan Pembelian. Butuh HTTPS (atau localhost) agar getUserMedia/geolocation diizinkan browser.
   ========================================================= */
const ENABLE_REVERSE_GEOCODE = true; // set false jika tidak ingin memanggil layanan geocoding eksternal

let cameraStreamObj = null;
let cameraFacingMode = 'environment'; // default kamera belakang di HP
let cameraHasMultipleDevices = false;
let cameraOnCaptureCallback = null;
let cameraCapturedDataUrl = null;
let cameraGeo = { lat: null, lng: null, accuracy: null, address: null, status: 'Mendeteksi lokasi...' };

// Membuka modal kamera. onCaptureCallback(dataUrl, meta) dipanggil saat user menekan "Gunakan Foto".
// meta berisi { timestamp, lat, lng, address }.
async function openCameraCapture(onCaptureCallback, title) {
    cameraOnCaptureCallback = onCaptureCallback;
    cameraCapturedDataUrl = null;
    cameraGeo = { lat: null, lng: null, accuracy: null, address: null, status: 'Mendeteksi lokasi...' };
    document.getElementById('camera-modal-title').textContent = title || 'Ambil Foto';
    document.getElementById('camera-modal').classList.remove('hidden');
    document.getElementById('camera-captured-preview').classList.add('hidden');
    document.getElementById('camera-live-wrap').classList.remove('hidden');
    document.getElementById('camera-controls-captured').classList.add('hidden');
    document.getElementById('camera-controls-live').classList.remove('hidden');
    if (window.lucide) lucide.createIcons();

    await detectCameraDeviceCount();
    await startCameraStream();
    fetchGeoLocationForCamera(); // berjalan paralel, tidak menunggu sebelum kamera tampil
}
// Mengecek jumlah kamera yang tersedia untuk menentukan apakah tombol "Ganti Kamera" ditampilkan.
async function detectCameraDeviceCount() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        cameraHasMultipleDevices = devices.filter(d => d.kind === 'videoinput').length > 1;
    } catch (err) {
        cameraHasMultipleDevices = true; // fallback: tetap tampilkan tombol ganti kalau gagal deteksi
    }
    document.getElementById('camera-switch-btn').classList.toggle('hidden', !cameraHasMultipleDevices);
}
// Memulai/reset video stream sesuai cameraFacingMode saat ini.
async function startCameraStream() {
    stopCameraStreamTracks();
    try {
        cameraStreamObj = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: cameraFacingMode } },
            audio: false
        });
        const video = document.getElementById('camera-video');
        video.srcObject = cameraStreamObj;
        await video.play();
    } catch (err) {
        toast('Tidak bisa mengakses kamera. Pastikan izin kamera diaktifkan dan situs diakses via HTTPS.', 'danger');
        closeCameraCapture();
    }
}
// Menghentikan seluruh track video aktif (dipanggil sebelum ganti kamera / saat modal ditutup).
function stopCameraStreamTracks() {
    if (cameraStreamObj) {
        cameraStreamObj.getTracks().forEach(t => t.stop());
        cameraStreamObj = null;
    }
}
// Beralih antara kamera depan (user) dan belakang (environment).
function switchCamera() {
    cameraFacingMode = cameraFacingMode === 'environment' ? 'user' : 'environment';
    startCameraStream();
}
// Mengambil lokasi GPS realtime. Kalau berhasil & fitur reverse-geocode aktif, coba dapatkan nama alamat.
function fetchGeoLocationForCamera() {
    const statusEl = document.getElementById('camera-geo-status');
    if (!navigator.geolocation) {
        cameraGeo.status = 'Perangkat tidak mendukung GPS.';
        if (statusEl) statusEl.textContent = cameraGeo.status;
        return;
    }
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            cameraGeo.lat = pos.coords.latitude;
            cameraGeo.lng = pos.coords.longitude;
            cameraGeo.accuracy = pos.coords.accuracy;
            cameraGeo.status = `Lat ${cameraGeo.lat.toFixed(6)}, Long ${cameraGeo.lng.toFixed(6)}`;
            if (statusEl) statusEl.textContent = cameraGeo.status;
            if (ENABLE_REVERSE_GEOCODE) reverseGeocodeForCamera(cameraGeo.lat, cameraGeo.lng);
        },
        (err) => {
            cameraGeo.status = 'Lokasi tidak tersedia (izin ditolak/GPS mati).';
            if (statusEl) statusEl.textContent = cameraGeo.status;
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}
// (Opsional/Bonus) Reverse geocoding via Nominatim (OpenStreetMap, gratis, tanpa API key).
// Untuk pemakaian volume tinggi/produksi, pertimbangkan layanan berbayar (Google Geocoding dll)
// karena Nominatim punya rate limit ketat untuk pemakaian komersial.
async function reverseGeocodeForCamera(lat, lng) {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`);
        const data = await res.json();
        if (data && data.display_name) {
            cameraGeo.address = data.display_name;
            const statusEl = document.getElementById('camera-geo-status');
            if (statusEl) statusEl.textContent = cameraGeo.address;
        }
    } catch (err) {
        // gagal reverse geocode -> tetap pakai koordinat, tidak fatal
    }
}
// Mengambil frame video saat ini, membakar watermark (tanggal/waktu/lokasi), menampilkan hasilnya.
function captureCameraPhoto() {
    const video = document.getElementById('camera-video');
    const canvas = document.getElementById('camera-canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    drawCameraWatermark(ctx, canvas.width, canvas.height);
    cameraCapturedDataUrl = canvas.toDataURL('image/jpeg', 0.9);

    document.getElementById('camera-captured-preview').src = cameraCapturedDataUrl;
    document.getElementById('camera-captured-preview').classList.remove('hidden');
    document.getElementById('camera-live-wrap').classList.add('hidden');
    document.getElementById('camera-controls-live').classList.add('hidden');
    document.getElementById('camera-controls-captured').classList.remove('hidden');
}
// Menggambar overlay watermark (tanggal, jam, lokasi/alamat) di sudut kiri-bawah foto.
function drawCameraWatermark(ctx, w, h) {
    const now = new Date();
    const line1 = now.toLocaleString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const line2 = cameraGeo.address
        ? cameraGeo.address
        : (cameraGeo.lat ? `Lat ${cameraGeo.lat.toFixed(6)}, Long ${cameraGeo.lng.toFixed(6)}` : 'Lokasi tidak tersedia');

    const fontSize = Math.max(14, Math.round(w * 0.022));
    ctx.font = `${fontSize}px Arial`;
    const padding = fontSize * 0.6;
    const lineHeight = fontSize * 1.4;
    const boxHeight = lineHeight * 2 + padding * 2;

    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, h - boxHeight, w, boxHeight);

    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'top';
    ctx.fillText(line1, padding, h - boxHeight + padding);
    ctx.fillText(line2, padding, h - boxHeight + padding + lineHeight);
}
// Kembali ke mode live preview untuk mengambil ulang foto (stream kamera tetap berjalan).
function retakeCameraPhoto() {
    cameraCapturedDataUrl = null;
    document.getElementById('camera-captured-preview').classList.add('hidden');
    document.getElementById('camera-live-wrap').classList.remove('hidden');
    document.getElementById('camera-controls-captured').classList.add('hidden');
    document.getElementById('camera-controls-live').classList.remove('hidden');
}
// Mengonfirmasi hasil foto: mengirim dataUrl + metadata ke form pemanggil, lalu menutup modal.
function useCapturedCameraPhoto() {
    if (!cameraCapturedDataUrl || !cameraOnCaptureCallback) return;
    cameraOnCaptureCallback(cameraCapturedDataUrl, {
        timestamp: new Date().toISOString(),
        lat: cameraGeo.lat, lng: cameraGeo.lng, address: cameraGeo.address
    });
    closeCameraCapture();
}
// Menutup modal kamera & memastikan stream video dimatikan (penting agar lampu kamera HP tidak menyala terus).
function closeCameraCapture() {
    stopCameraStreamTracks();
    document.getElementById('camera-modal').classList.add('hidden');
    cameraOnCaptureCallback = null;
}
// Menambahkan hasil foto kamera langsung sebagai lampiran Pengajuan Pembelian (tanpa lewat
// FileReader, karena sudah dalam bentuk dataUrl). Tetap dibatasi ATTACHMENT_MAX_COUNT.
function addCapturedPhotoToRequest(dataUrl) {
    if (pendingRequestAttachments.length >= ATTACHMENT_MAX_COUNT) {
        toast(`Maksimal ${ATTACHMENT_MAX_COUNT} lampiran per pengajuan.`, 'warning');
        return;
    }
    const approxSize = Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75);
    pendingRequestAttachments.push({
        id: uid('att'), name: `kamera-${Date.now()}.jpg`, type: 'image/jpeg', size: approxSize, dataUrl
    });
    renderRequestAttachmentPreview();
}

/* =========================================================
   AUTH & INISIALISASI
   ========================================================= */
// Akun bawaan (staff/admin/manajemen) selalu bisa dipakai login di device
// manapun -- tidak tergantung isi localStorage perangkat tersebut -- supaya
// staff/admin tidak pernah terkunci hanya karena membuka aplikasi di HP/PC
// baru atau localStorage-nya berbeda dari perangkat lain.
const DEFAULT_ACCOUNTS = [
    { id: 'u-staff', username: 'staff', password: 'staff123', name: 'Budi Santoso', role: 'staff' },
    { id: 'u-admin', username: 'admin', password: 'admin123', name: 'Sari Wijaya', role: 'admin' },
    { id: 'u-mgr', username: 'manajemen', password: 'manajemen123', name: 'Hendra Kusuma', role: 'manajemen' }
];
// Memproses submit form login: mencocokkan kredensial dengan user tersimpan, dengan fallback
// ke akun bawaan (DEFAULT_ACCOUNTS) jika belum cocok, lalu masuk ke aplikasi bila berhasil.
function doLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const db = getDB();
    let user = db.users.find(u => u.username === username && u.password === password);
    if (!user) {
        // Fallback: kredensial default tetap berlaku di device ini walau
        // belum pernah dibuka / datanya beda, sehingga bisa dipakai di mana saja.
        user = DEFAULT_ACCOUNTS.find(u => u.username === username && u.password === password);
    }
    if (!user) { toast('Username atau password salah.', 'danger'); return; }
    setSession(user);
    enterApp();
}
// Menghapus sesi login dan mengembalikan tampilan ke halaman login.
function doLogout() {
    clearSession();
    document.getElementById('app-layout').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('login-form').reset();
}
// Menampilkan layout utama aplikasi untuk pengguna yang sudah login, lalu menavigasi ke Dashboard.
function enterApp() {
    const u = currentUser();
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-layout').classList.remove('hidden');
    document.getElementById('user-display-name').textContent = u.name;
    document.getElementById('user-display-role').textContent = u.role;
    currentPage = 'dashboard';
    renderSidebar();
    navigateTo('dashboard');
}
// Memperbarui tampilan jam berjalan (live clock) di topbar, dipanggil tiap detik.
function updateClock() {
    const el = document.getElementById('live-clock');
    if (el) el.textContent = new Date().toLocaleString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
// Menerapkan preferensi tema (gelap/terang) yang tersimpan saat halaman pertama kali dimuat.
function initTheme() {
    const saved = localStorage.getItem('gudangkita_theme');
    if (saved === 'dark') {
        document.body.classList.remove('light-mode'); document.body.classList.add('dark-mode');
        document.querySelector('#theme-toggle i').setAttribute('data-lucide', 'sun');
    }
}
// Mengganti tema antara terang dan gelap, lalu menyimpan preferensinya ke localStorage.
function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-mode');
    document.body.classList.toggle('light-mode', !isDark);
    localStorage.setItem('gudangkita_theme', isDark ? 'dark' : 'light');
    document.querySelector('#theme-toggle i').setAttribute('data-lucide', isDark ? 'sun' : 'moon');
    if (window.lucide) lucide.createIcons();
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) lucide.createIcons();
    initTheme();

    document.getElementById('login-form').addEventListener('submit', doLogin);
    document.getElementById('logout-btn').addEventListener('click', doLogout);
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
    document.getElementById('mobile-toggle-open').addEventListener('click', () => document.getElementById('sidebar').classList.add('open'));
    document.getElementById('mobile-toggle-close').addEventListener('click', () => document.getElementById('sidebar').classList.remove('open'));

    setInterval(updateClock, 1000);
    updateClock();

    const session = getSession();
    if (session) enterApp();
});