# Proje Teknik Raporu: Blockchain Tabanlı Sertifika Sistemi

**Ders:** 1229748 – Dijital Dönüşüme Giriş  
**Konu:** Docker Üzerinde Blockchain ve Akıllı Kontrat ile Sertifika Doğrulama Sistemi

---

## 1. Mimari Tasarım

Proje, mikroservis mimarisine uygun olarak Docker konteynerleri üzerinde çalışan üç ana bileşenden oluşmaktadır:

### 1.1. Bileşenler
1.  **Ganache (Zincir):** Yerel Ethereum ağı simülasyonu.
    *   **Rolü:** Blokzincir ağını sağlar, hesapları ve bakiyeleri yönetir.
    *   **Konfigürasyon:** Chain ID 1337, 10 adet test hesabı, 1 saniye blok süresi.
2.  **Hardhat (Dağıtıcı):** Geliştirme ve test ortamı.
    *   **Rolü:** Akıllı kontratı (`CertificateRegistry.sol`) derler ve Ganache ağına dağıtır (deploy).
3.  **Client (İstemci):** Node.js tabanlı kullanıcı arayüzü (CLI).
    *   **Rolü:** Sertifika verilerini hashler, zincire kaydeder (Issue), doğrular (Verify) ve iptal eder (Revoke).

### 1.2. Ağ Yapısı
Tüm bileşenler `certnet` isimli izole bir Docker ağı üzerinde haberleşir.
*   `client` -> `ganache:8545` (RPC çağrıları)
*   `hardhat` -> `ganache:8545` (Kontrat dağıtımı)

---

## 2. Akıllı Kontrat Tasarımı (`CertificateRegistry.sol`)

Kontrat, sertifikaların yaşam döngüsünü yönetmek için geliştirilmiştir.

### 2.1. Fonksiyonlar
*   **`issue(...)`**: Yeni bir sertifika kaydı oluşturur. Sadece kontrat sahibi (`onlyOwner`) çağırabilir.
*   **`revoke(...)`**: Mevcut bir sertifikayı iptal eder. Sadece kontrat sahibi çağırabilir.
*   **`verify(...)`**: Herkes tarafından çağrılabilir. Sertifikanın geçerlilik durumunu, iptal edilip edilmediğini ve son kullanma tarihini kontrol eder.

### 2.2. Veri Yapısı
```solidity
struct Certificate {
    bytes32 id;           // Benzersiz Sertifika ID
    bytes32 holderHash;   // Kişisel verilerin özeti (Hash)
    string  title;        // Sertifika başlığı
    string  issuer;       // Veren kurum
    uint64  issuedAt;     // Veriliş tarihi
    uint64  expiresAt;    // Son kullanma tarihi
    bool    revoked;      // İptal durumu
}
```

---

## 3. Güvenlik ve KVKK Değerlendirmesi

Kişisel Verilerin Korunması Kanunu (KVKK) uyumluluğu projenin merkezindedir.

### 3.1. Gizlilik Stratejisi (Hash + Salt)
Zincire asla açık metin (plaintext) olarak kişisel veri (Ad, Soyad, TC No vb.) yazılmaz. Bunun yerine tek yönlü şifreleme (hashing) kullanılır.

**Formül:**
`holderHash = keccak256(ÖğrenciNo | AdSoyad | Salt)`

*   **Salt (Tuzlama):** Rastgele üretilen 32 baytlık bir veridir. Hash değerinin "Rainbow Table" saldırılarıyla çözülmesini engeller.
*   **Doğrulama:** Doğrulama yapmak isteyen taraf, elindeki veriyi aynı formülle hashleyerek zincirdeki kayıtla eşleştirir.

### 3.2. Erişim Kontrolü
*   `onlyOwner` modifier'ı sayesinde sertifika verme ve iptal etme yetkisi sadece kontratı dağıtan (deployer) adrese aittir.

---

## 4. Test Kanıtları

Proje hem birim testleri (Unit Tests) hem de uçtan uca (E2E) senaryolarla doğrulanmıştır.

### 4.1. Birim Testleri (Hardhat)
`npx hardhat test` komutu ile aşağıdaki senaryolar başarılmıştır:
*   ✅ Sertifika başarıyla oluşturuluyor ve doğrulanıyor.
*   ✅ Sertifika başarıyla iptal ediliyor (revoked).
*   ✅ Yetkisiz kullanıcılar sertifika oluşturamıyor.

### 4.2. İstemci Senaryosu (Docker Logları)
Sistem çalıştığında (`docker-compose up`) istemci şu adımları otomatik gerçekleştirir:
1.  **Issue:** Yeni sertifika üretilir. -> `SUCCESS`
2.  **Verify:** Sertifika doğrulanır. -> `Valid: true`
3.  **Revoke:** Sertifika iptal edilir. -> `SUCCESS`
4.  **Verify (Tekrar):** İptal durumu kontrol edilir. -> `Valid: false, Revoked: true`

---

## 5. Sonuç
Bu proje, blokzincir teknolojisinin eğitim sektöründe güvenli ve şeffaf belge doğrulama amacıyla nasıl kullanılabileceğini başarıyla modellemiştir. Docker ile taşınabilir, Hardhat ile test edilebilir ve KVKK uyumlu bir yapı kurulmuştur.
