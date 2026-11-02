package expo.modules.zeppelinvpn

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Small encrypted file store for WireGuard profiles (they contain private keys).
 *
 * AES-256-GCM with a key that lives in the Android Keystore and never leaves it.
 * Files are kept in noBackupFilesDir, and the app sets allowBackup=false.
 * There is no plaintext fallback: if encryption fails, the write fails.
 */
object SecureVault {
  private const val KEY_ALIAS = "zeppelin_vault_v1"
  private const val DIR = "zeppelin_vault"
  private const val FORMAT_VERSION: Byte = 1
  private const val GCM_TAG_BITS = 128
  private val NAME = Regex("[a-z_]{1,32}")
  private val lock = Any()

  private fun secretKey(): SecretKey {
    val keyStore = KeyStore.getInstance("AndroidKeyStore")
    keyStore.load(null)
    val existing = keyStore.getKey(KEY_ALIAS, null)
    if (existing is SecretKey) return existing
    val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
    generator.init(
      KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setKeySize(256)
        .build()
    )
    return generator.generateKey()
  }

  private fun file(context: Context, name: String): File {
    require(NAME.matches(name)) { "Invalid vault entry name" }
    val dir = File(context.noBackupFilesDir, DIR)
    if (!dir.exists() && !dir.mkdirs()) throw IOException("Cannot create vault directory")
    return File(dir, "$name.bin")
  }

  fun write(context: Context, name: String, plainText: String) {
    synchronized(lock) {
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.ENCRYPT_MODE, secretKey())
      val iv = cipher.iv
      val encrypted = cipher.doFinal(plainText.toByteArray(Charsets.UTF_8))
      val blob = ByteArray(2 + iv.size + encrypted.size)
      blob[0] = FORMAT_VERSION
      blob[1] = iv.size.toByte()
      System.arraycopy(iv, 0, blob, 2, iv.size)
      System.arraycopy(encrypted, 0, blob, 2 + iv.size, encrypted.size)

      val target = file(context, name)
      val temp = File(target.parentFile, target.name + ".tmp")
      FileOutputStream(temp).use { out ->
        out.write(blob)
        out.fd.sync()
      }
      if (!temp.renameTo(target)) {
        target.delete()
        if (!temp.renameTo(target)) {
          temp.delete()
          throw IOException("Cannot save vault entry")
        }
      }
    }
  }

  /** Returns null when the entry does not exist; throws when it exists but cannot be decrypted. */
  fun read(context: Context, name: String): String? {
    synchronized(lock) {
      val f = file(context, name)
      if (!f.exists()) return null
      val blob = f.readBytes()
      if (blob.size < 2 || blob[0] != FORMAT_VERSION) throw IOException("Unknown vault format")
      val ivLength = blob[1].toInt()
      if (ivLength <= 0 || blob.size < 2 + ivLength + GCM_TAG_BITS / 8) throw IOException("Corrupt vault entry")
      val iv = blob.copyOfRange(2, 2 + ivLength)
      val encrypted = blob.copyOfRange(2 + ivLength, blob.size)
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.DECRYPT_MODE, secretKey(), GCMParameterSpec(GCM_TAG_BITS, iv))
      return String(cipher.doFinal(encrypted), Charsets.UTF_8)
    }
  }

  fun delete(context: Context, name: String) {
    synchronized(lock) {
      file(context, name).delete()
    }
  }

  /** Removes every entry and the key itself (used by "Delete all data"). */
  fun clear(context: Context) {
    synchronized(lock) {
      File(context.noBackupFilesDir, DIR).listFiles()?.forEach { it.delete() }
      try {
        val keyStore = KeyStore.getInstance("AndroidKeyStore")
        keyStore.load(null)
        if (keyStore.containsAlias(KEY_ALIAS)) keyStore.deleteEntry(KEY_ALIAS)
      } catch (e: Exception) {
        // A new key is created on the next write anyway.
      }
    }
  }
}
