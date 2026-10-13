package com.nyra.pulse

import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.widget.Toast
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.OutputStream

/**
 * Saves files the website generates in the browser (blob: downloads such as "save song" and the
 * Instagram downloader). A WebView can't do that on its own, so the page streams the bytes to us in
 * base64 chunks (see assets/nyra-helpers.js) and we write them to Downloads/NYRA.
 */
class DownloadSaver(context: Context) {

    private val context = context.applicationContext

    private class Session(
        val name: String,
        val out: OutputStream,
        val uri: Uri?,   // Android 10+ (MediaStore)
        val file: File?, // Android 8-9 (app-specific folder, no permission needed)
    )

    private val sessions = HashMap<String, Session>()

    fun start(id: String, rawName: String, mime: String) {
        val name = sanitize(rawName)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val values = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, name)
                    put(MediaStore.Downloads.MIME_TYPE, mime)
                    put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/NYRA")
                    put(MediaStore.Downloads.IS_PENDING, 1)
                }
                val uri = context.contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                    ?: throw IOException("Could not create file")
                val out = context.contentResolver.openOutputStream(uri)
                    ?: throw IOException("Could not open file")
                sessions[id] = Session(name, out, uri, null)
            } else {
                val dir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) ?: context.filesDir
                val file = uniqueFile(dir, name)
                sessions[id] = Session(file.name, FileOutputStream(file), null, file)
            }
        } catch (e: Exception) {
            toast("Couldn't save $name")
        }
    }

    fun chunk(id: String, base64: String) {
        val session = sessions[id] ?: return
        try {
            session.out.write(Base64.decode(base64, Base64.DEFAULT))
        } catch (e: Exception) {
            abort(id)
            toast("Couldn't save ${session.name}")
        }
    }

    fun end(id: String) {
        val session = sessions.remove(id) ?: return
        try {
            session.out.close()
            if (session.uri != null) {
                val done = ContentValues().apply { put(MediaStore.Downloads.IS_PENDING, 0) }
                context.contentResolver.update(session.uri, done, null, null)
                toast("Saved to Downloads/NYRA: ${session.name}")
            } else {
                toast("Saved: ${session.name}")
            }
        } catch (e: Exception) {
            toast("Couldn't save ${session.name}")
        }
    }

    fun abort(id: String) {
        val session = sessions.remove(id) ?: return
        try {
            session.out.close()
        } catch (e: Exception) {
            // ignore
        }
        if (session.uri != null) {
            context.contentResolver.delete(session.uri, null, null)
        } else {
            session.file?.delete()
        }
    }

    private fun sanitize(raw: String): String {
        val cleaned = raw.replace(Regex("[\\\\/:*?\"<>|\\p{Cntrl}]"), "_").trim().trimStart('.')
        return cleaned.ifEmpty { "nyra-download" }.take(120)
    }

    private fun uniqueFile(dir: File, name: String): File {
        var file = File(dir, name)
        if (!file.exists()) return file
        val dot = name.lastIndexOf('.')
        val base = if (dot > 0) name.substring(0, dot) else name
        val ext = if (dot > 0) name.substring(dot) else ""
        var n = 1
        while (file.exists()) {
            file = File(dir, "$base ($n)$ext")
            n++
        }
        return file
    }

    private fun toast(message: String) {
        Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
    }
}
