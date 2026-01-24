import os
import datetime
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Intentamos importar Rich para una interfaz profesional
try:
    from rich.console import Console
    from rich.markdown import Markdown
    from rich.panel import Panel
    console = Console()
    USA_RICH = True
except ImportError:
    USA_RICH = False

# 1. Carga de Secretos
load_dotenv()
API_KEY = os.getenv("GOOGLE_API_KEY")

# 2. Configuración del Modelo (Tu llave maestra)
# Usamos el modelo Preview porque es el más inteligente disponible por API hoy.
MODEL_ID = "gemini-3-pro-preview"

# 3. EL CEREBRO: System Instruction (Instrucción de Sistema)
# Esto es lo que lo convierte en "High Thinking"
SYSTEM_INSTRUCTION = """
Eres un Arquitecto de Software Senior y experto en Pensamiento Crítico.
Tu objetivo no es solo responder, sino cuestionar, analizar y proponer la mejor solución técnica.
Reglas de comportamiento:
1.  **Análisis Primero:** Antes de dar código, piensa en los casos borde (edge cases).
2.  **Calidad:** Tu código debe ser robusto, limpio y seguir PEP8.
3.  **Seguridad:** Advierte siempre sobre vulnerabilidades potenciales.
4.  **Concisión:** Sé directo. Evita la cortesía excesiva. Ve al grano técnico.
5.  **Formato:** Usa Markdown para estructurar tus respuestas.
"""

class AsistentePro:
    def __init__(self):
        self.client = genai.Client(api_key=API_KEY)
        self.chat_history = [] # Memoria de corto plazo
        self.log_file = "historial_sesion.md" # Memoria persistente
        self._inicializar_log()

    def _inicializar_log(self):
        """Crea o limpia el archivo de log al inicio."""
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(self.log_file, "a", encoding="utf-8") as f:
            f.write(f"\n\n--- NUEVA SESIÓN: {timestamp} ---\n")

    def _imprimir(self, texto, estilo="bold white"):
        """Maneja la impresión bonita o simple."""
        if USA_RICH:
            console.print(texto, style=estilo)
        else:
            print(texto)

    def _imprimir_markdown(self, texto):
        if USA_RICH:
            console.print(Markdown(texto))
        else:
            print(texto)

    def guardar_en_disco(self, role, texto):
        """Guarda la conversación para que el Agente de Antigravity pueda leerla."""
        with open(self.log_file, "a", encoding="utf-8") as f:
            f.write(f"\n**{role.upper()}:**\n{texto}\n")

    def chatear(self):
        self._imprimir(Panel(f"🚀 INICIANDO SISTEMA [Model: {MODEL_ID}]", title="GEMINI PRO CLI", border_style="green"))
        
        # Iniciamos la sesión de chat con el System Prompt
        chat_session = self.client.chats.create(
            model=MODEL_ID,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                temperature=0.7, # Creatividad balanceada
            ),
            history=self.chat_history
        )

        while True:
            try:
                if USA_RICH:
                    user_input = console.input("\n[bold cyan]TÚ ➜ [/]")
                else:
                    user_input = input("\nTÚ ➜ ")

                if user_input.lower() in ['salir', 'exit', 'quit']:
                    self._imprimir("\n[red]Cerrando sesión... Hasta luego.[/]")
                    break

                if not user_input.strip():
                    continue

                # Guardamos lo que tú dijiste
                self.guardar_en_disco("Usuario", user_input)

                self._imprimir("\n[dim]Pensando...[/]")

                # LLAMADA A LA API (Con Streaming para velocidad)
                response_stream = chat_session.send_message_stream(user_input)
                
                full_response = ""
                print() # Salto de línea
                
                # Procesamos la respuesta en tiempo real
                for chunk in response_stream:
                    if chunk.text:
                        print(chunk.text, end="", flush=True)
                        full_response += chunk.text

                print() # Salto final
                
                # Guardamos lo que la IA dijo
                self.guardar_en_disco("Gemini", full_response)

            except Exception as e:
                self._imprimir(f"\n[bold red]❌ ERROR CRÍTICO:[/]\n{e}")
                self._imprimir("[yellow]Intenta reformular tu pregunta o verifica tu cuota.[/]")

if __name__ == "__main__":
    if not API_KEY:
        print("❌ ERROR: No se encontró GOOGLE_API_KEY en el archivo .env")
    else:
        bot = AsistentePro()
        bot.chatear()