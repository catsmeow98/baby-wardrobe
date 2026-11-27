package com.babywardrobe.app;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.segmentation.subject.SubjectSegmentation;
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenter;
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenterOptions;

import java.nio.FloatBuffer;

/**
 * Background removal with Google ML Kit subject segmentation, on the phone. The web page sends a JPEG (base64, no data: prefix)
 * and gets back the foreground confidence mask: one byte (0..255) per pixel, base64, at the photo's own width and height,
 * plus ML Kit's processing time in milliseconds. The page does the cleanup and makes the cutout, as for its other models.
 */
@CapacitorPlugin(name = "SubjectSegmenter")
public class SubjectSegmenterPlugin extends Plugin {

    @PluginMethod
    public void segment(PluginCall call) {
        String data = call.getString("image");
        if (data == null || data.isEmpty()) {
            call.reject("No image was sent.");
            return;
        }
        final Bitmap bmp;
        try {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        } catch (IllegalArgumentException e) {
            call.reject("The image could not be read.");
            return;
        }
        if (bmp == null) {
            call.reject("The image could not be read.");
            return;
        }
        SubjectSegmenterOptions options = new SubjectSegmenterOptions.Builder().enableForegroundConfidenceMask().build();
        final SubjectSegmenter segmenter = SubjectSegmentation.getClient(options);
        final long start = System.nanoTime();
        segmenter.process(InputImage.fromBitmap(bmp, 0))
            .addOnSuccessListener(result -> {
                FloatBuffer mask = result.getForegroundConfidenceMask();
                int w = bmp.getWidth();
                int h = bmp.getHeight();
                if (mask == null) {
                    segmenter.close();
                    call.reject("ML Kit gave no mask.");
                    return;
                }
                mask.rewind();
                byte[] alpha = new byte[w * h];
                for (int i = 0; i < alpha.length && mask.hasRemaining(); i++) {
                    float v = mask.get();
                    alpha[i] = (byte) Math.round(Math.max(0f, Math.min(1f, v)) * 255f);
                }
                JSObject ret = new JSObject();
                ret.put("mask", Base64.encodeToString(alpha, Base64.NO_WRAP));
                ret.put("width", w);
                ret.put("height", h);
                ret.put("ms", (System.nanoTime() - start) / 1_000_000.0);
                segmenter.close();
                call.resolve(ret);
            })
            .addOnFailureListener(e -> {
                segmenter.close();
                // The model comes from Play services; the first run can fail while it downloads.
                call.reject("ML Kit could not cut this out: " + e.getMessage() + " (if it says the module is downloading, wait a minute and try again)");
            });
    }
}
