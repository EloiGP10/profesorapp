/**
 * Política de contraseñas.
 *
 * Buscamos algo que un profesor pueda recordar sin papel: longitud mínima
 * razonable, sin exigir símbolos ni mayúsculas (empujan a `Password1!`, que
 * aparece en cualquier diccionario de contraseñas filtradas) y rechazo de las
 * contraseñas más usadas, que son las que se prueban primero.
 */

const MIN_LENGTH = 10;

/** Top de contraseñas filtradas más atacadas; ninguna debe permitirse. */
const COMMON = new Set([
  "123456789", "12345678", "password", "contrasena", "contrasenya",
  "1234567890", "qwertyuiop", "12345678a", "iloveyou", "princess",
  "admin123", "welcome", "abc123", "football", "teacher", "profesor",
  "colegio123", "alumno2026", "changeme", "1234567a", "michael123",
  "password1", "qwerty123", "123456789a", "estaloquesea", "juntos",
]);

export function checkPasswordStrength(password: string): {
  ok: boolean;
  error?: string;
} {
  if (password.length < MIN_LENGTH) {
    return {
      ok: false,
      error: `La contraseña debe tener al menos ${MIN_LENGTH} caracteres`,
    };
  }

  const normalized = password.toLowerCase();
  if (COMMON.has(normalized)) {
    return {
      ok: false,
      error: "Esa contraseña es demasiado común. Elige otra.",
    };
  }

  // Sin suficiente variedad: rechaza "aaaaaaaaaaaa" o "123123123123".
  const uniqueChars = new Set(normalized).size;
  if (uniqueChars < 4) {
    return {
      ok: false,
      error: "La contraseña necesita más caracteres distintos",
    };
  }

  return { ok: true };
}