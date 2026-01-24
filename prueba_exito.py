import os
from dotenv import load_dotenv
from google import genai
from anthropic import Anthropic

# Cargar claves
load_dotenv()

print("--- 🚀 INICIANDO PRUEBA FINAL (CON MODELOS CONFIRMADOS) 🚀 ---")

# ==========================================
# 1. PRUEBA GEMINI (Usando Gemini 2.0 Flash)
# ==========================================
try:
    print("\n🔮 Conectando con GEMINI 2.0...")
    client_google = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
    
    # EL CAMBIO CLAVE: Usamos uno de la lista que te salió en el diagnóstico
    model_id = 'gemini-2.5-flash'
    
    response = client_google.models.generate_content(
        model=model_id, 
        contents='Responde en una palabra: ¡OPERATIVO!'
    )
    print(f"✅ GEMINI ({model_id}) RESPONDIÓ: {response.text}")

except Exception as e:
    print(f"❌ ERROR GEMINI: {e}")

# ==========================================
# 2. PRUEBA CLAUDE (Usando Haiku)
# ==========================================
try:
    print("\n🧠 Conectando con CLAUDE (Haiku)...")
    client_claude = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    
    # EL CAMBIO CLAVE: Usamos el modelo que SI te funcionó en el diagnóstico
    model_id = "claude-3-haiku-20240307"
    
    message = client_claude.messages.create(
        model=model_id,
        max_tokens=50,
        messages=[{"role": "user", "content": "Responde en una palabra: ¡OPERATIVO!"}]
    )
    print(f"✅ CLAUDE ({model_id}) RESPONDIÓ: {message.content[0].text}")
    print("\nℹ️ NOTA: Claude Sonnet (3.5/4.5) se activará automáticamente en unas horas")
    print("   cuando Anthropic valide tu pago y subas de 'Tier 1' a 'Tier 2'.")

except Exception as e:
    print(f"❌ ERROR CLAUDE: {e}")

print("\n--- ✅ FIN DE LA INSTALACIÓN ---")
