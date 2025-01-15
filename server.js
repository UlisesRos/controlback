const express = require("express");
const multer = require("multer");
const Tesseract = require("tesseract.js");
const cors = require("cors");
const fs = require("fs");
const sharp = require("sharp");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json());

// Ruta para procesar la imagen
app.post("/process-image", upload.single("image"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No se proporcionó una imagen" });
    }

    const imagePath = req.file.path;
    const processedImagePath = `uploads/processed_${req.file.filename}.png`; // Ruta para la imagen procesada

    // Preprocesar la imagen con sharp para mejorar la calidad
    sharp(imagePath)
        .resize(1024) // Redimensionar la imagen para mejorar la velocidad y precisión de OCR
        .greyscale() // Convertir a escala de grises
        .normalize() // Mejorar el contraste
        .toFile(processedImagePath, (err, info) => {
            if (err) {
                console.error("Error al procesar la imagen:", err);
                return res.status(500).json({ error: "Error al procesar la imagen" });
            }

            console.log("Imagen procesada:", info);

            // Procesar la imagen con Tesseract.js
            Tesseract.recognize(processedImagePath, "eng", {
                tessedit_char_whitelist: "0123456789.", // Limitar a números y puntos decimales
                logger: (info) => console.log(info), // Progreso opcional
            })
                .then(({ data: { text } }) => {
                    console.log("Texto extraído del OCR:", text); // Para depuración

                    // Separar texto en líneas
                    const lines = text.split("\n").filter((line) => line.trim() !== "");
                    console.log("Líneas extraídas:", lines);

                    let total = 0;
                    let lineData = []; // Guardar los datos de cada línea para enviar al frontend

                    // Procesar cada línea
                    try {
                        lines.forEach((line, index) => {
                            const numbers = line
                                .split(/\s+/) // Dividir por espacios o tabulaciones
                                .map((num) => parseFloat(num)) // Convertir a número
                                .filter((num) => !isNaN(num)); // Filtrar valores no numéricos

                            console.log(`Línea ${index + 1}: Números detectados ->`, numbers);

                            // Guardar los números detectados para cada línea
                            lineData.push({
                                line: index + 1,
                                numbers: numbers,
                            });

                            // Si hay exactamente dos números, realizar la multiplicación
                            if (numbers.length === 2) {
                                total += numbers[0] * numbers[1];
                            }
                        });

                        console.log("Total acumulado:", total);

                        // Eliminar el archivo temporal procesado después de procesarlo
                        fs.unlink(processedImagePath, (err) => {
                            if (err) console.error("Error al eliminar el archivo procesado:", err);
                        });

                        // Eliminar el archivo original también
                        fs.unlink(imagePath, (err) => {
                            if (err) console.error("Error al eliminar el archivo original:", err);
                        });

                        // Devolver el total y los datos de las líneas al frontend
                        res.json({ total, lines: lineData });
                    } catch (error) {
                        console.error("Error al procesar los números:", error);
                        res.status(500).json({ error: "Error al procesar los números" });
                    }
                })
                .catch((error) => {
                    console.error("Error durante el reconocimiento OCR:", error);
                    res.status(500).json({ error: "Error en el reconocimiento OCR" });
                });
        });
});

// Iniciar el servidor
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
