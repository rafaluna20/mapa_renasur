'use client';

import { useEffect, useRef, useState } from 'react';
import { Lot } from '@/app/data/lotsData';

// Nudge decorativo pedido por el cliente: un marcador que "salta" a
// posiciones aleatorias sobre el mapa cada pocos segundos, invitando a
// hacer clic. A propósito NO intenta apuntar al pixel exacto de un lote
// real en pantalla (eso exigiría exponer la proyección lat/lng->pixel de
// Leaflet fuera de LeafletMap.tsx, un componente compartido con el mapa de
// staff) — la posición es aproximada/decorativa, pero el clic SÍ es real:
// abre el panel de un lote disponible de verdad, elegido al azar entre los
// que sí se pueden comprar (nunca uno vendido/reservado).
//
// Cuando hay un lote seleccionado (y ese lote es disponible), el pin deja
// de saltar y se "congela" en el centro del mapa — no es un truco: al
// seleccionar un lote, LeafletMap ya lo centra en pantalla (flyTo a
// bounds.getCenter(), ver LeafletMap.tsx), así que el centro del canvas
// SÍ es donde quedó ese lote. Si el lote seleccionado NO es disponible
// (alguien lo clickeó directo en el mapa), el pin se sigue ocultando —
// mostrarlo ahí contradiría la regla de "solo apunta a disponibles".
//
// Reporte real del cliente: al alejarse/arrastrar el mapa después de
// seleccionar un lote, el pin se quedaba apuntando al centro de siempre —
// que ya no es donde está el lote. Por eso PublicMapSection.tsx deja de
// pasar `selectedLot` (manda null) apenas detecta que el usuario arrastró
// el mapa de verdad — esa decisión vive ahí, no acá, así este componente
// no necesita saber nada de Leaflet ni de cómo se detecta el arrastre.
//
// Reporte real del cliente: "el botón no funciona bien al hacer clic".
// Verificado con hit-test preciso (elementFromPoint) sobre las coordenadas
// reales del label y del ícono: ambos SÍ resuelven al botón — no hay bug de
// área clickeable. La causa real es otra: el botón entero salta a una
// posición nueva (o desaparece) cada ~6.3s, así que si alguien tarda en
// apuntar y hacer clic, el objetivo ya cambió de lugar y el clic cae sobre
// el lote real del mapa que quedó debajo. Se soluciona pausando el ciclo
// mientras el cursor/dedo está sobre el botón (mouseenter/touchstart) — el
// mismo patrón que usa cualquier tooltip que no debe cerrarse solo porque
// pasó el tiempo mientras el usuario lo está mirando.
interface LotPointerHintProps {
    lots: Lot[];
    active: boolean;
    selectedLot: Lot | null;
    onPick: (lot: Lot) => void;
}

const POSITIONS = [
    { top: '20%', left: '30%' },
    { top: '38%', left: '60%' },
    { top: '58%', left: '32%' },
    { top: '26%', left: '72%' },
    { top: '62%', left: '58%' },
    { top: '45%', left: '18%' },
];

// El ciclo completo (visible + espera) es el tiempo entre un salto y el
// siguiente — pedido explícito del cliente: al menos ~6s entre ubicaciones,
// para que el nudge no se sienta apurado ni compita por atención con el
// resto de la página. 4.3s + 2s = 6.3s, con margen sobre el mínimo pedido.
const VISIBLE_MS = 4300;
const GAP_MS = 2000;
const FIRST_DELAY_MS = 1800;
// Mientras está pausado (hover/touch), se reintenta ocultar cada 300ms en
// vez de una sola vez — así el botón queda quieto todo el tiempo que el
// usuario lo esté mirando/tocando, no un tiempo fijo extra.
const PAUSE_RECHECK_MS = 300;

function PinIcon() {
    return (
        <svg viewBox="0 0 24 24" className="venta-map-hint-icon" aria-hidden="true">
            <path
                d="M12 2C8.13 2 5 5.24 5 9.2 5 14.6 12 22 12 22s7-7.4 7-12.8C19 5.24 15.87 2 12 2zm0 9.7a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"
                fill="currentColor"
            />
        </svg>
    );
}

export default function LotPointerHint({ lots, active, selectedLot, onPick }: LotPointerHintProps) {
    const [posIndex, setPosIndex] = useState(0);
    const [visible, setVisible] = useState(false);
    const [lot, setLot] = useState<Lot | null>(null);
    // `lots` (lotesDisponibles en PublicMapSection) es un array nuevo en
    // cada render — depender de él directamente en el effect de abajo
    // reiniciaría el ciclo antes de que termine. Se mantiene fresco en un
    // ref (actualizado en su propio effect, nunca durante el render) y se
    // lee desde el tick del temporizador, sin retrigger del effect.
    const lotsRef = useRef(lots);
    useEffect(() => {
        lotsRef.current = lots;
    }, [lots]);

    // Se lee dentro del temporizador (no dispara re-render ni retrigger del
    // effect), así que un ref alcanza — no hace falta useState acá.
    const pausedRef = useRef(false);

    useEffect(() => {
        if (!active) return;

        let cancelled = false;
        const timers: ReturnType<typeof setTimeout>[] = [];

        // "Reducir movimiento" pide no FORZAR animación — no eliminar la
        // función entera (eso era lo que hacía antes: directamente nunca
        // se mostraba). Acá se muestra una sola vez, quieto (el CSS ya
        // apaga el rebote/salto bajo este media query) y sin volver a
        // ocultarse — una aparición estable expone el atajo sin imponerle
        // movimiento continuo a quien pidió evitarlo.
        const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reducedMotion) {
            timers.push(
                setTimeout(() => {
                    if (cancelled) return;
                    const pool = lotsRef.current;
                    if (pool.length === 0) return;
                    setLot(pool[Math.floor(Math.random() * pool.length)]);
                    setPosIndex(0);
                    setVisible(true);
                }, FIRST_DELAY_MS)
            );
            return () => {
                cancelled = true;
                timers.forEach(clearTimeout);
            };
        }

        const hideWhenNotPaused = () => {
            if (cancelled) return;
            if (pausedRef.current) {
                timers.push(setTimeout(hideWhenNotPaused, PAUSE_RECHECK_MS));
                return;
            }
            setVisible(false);
            timers.push(setTimeout(tick, GAP_MS));
        };

        const tick = () => {
            if (cancelled) return;
            const pool = lotsRef.current;
            if (pool.length === 0) {
                timers.push(setTimeout(tick, GAP_MS));
                return;
            }
            setLot(pool[Math.floor(Math.random() * pool.length)]);
            setPosIndex((i) => (i + 1) % POSITIONS.length);
            setVisible(true);
            timers.push(setTimeout(hideWhenNotPaused, VISIBLE_MS));
        };
        timers.push(setTimeout(tick, FIRST_DELAY_MS));

        return () => {
            cancelled = true;
            timers.forEach(clearTimeout);
        };
    }, [active]);

    if (selectedLot) {
        return (
            <div className="venta-map-hint venta-map-hint--frozen" aria-hidden="true">
                <span className="venta-map-hint-label">Lote aquí</span>
                <PinIcon />
            </div>
        );
    }

    if (!active || !visible || !lot) return null;

    return (
        <button
            type="button"
            className="venta-map-hint"
            style={POSITIONS[posIndex]}
            onClick={() => onPick(lot)}
            onMouseEnter={() => {
                pausedRef.current = true;
            }}
            onMouseLeave={() => {
                pausedRef.current = false;
            }}
            onTouchStart={() => {
                pausedRef.current = true;
            }}
            onTouchEnd={() => {
                pausedRef.current = false;
            }}
            onTouchCancel={() => {
                pausedRef.current = false;
            }}
            // Mismo problema que resuelve mouseenter/touchstart, pero para
            // quien navega con teclado: sin esto, un usuario que llega acá
            // con Tab puede tener el botón moviéndose o desapareciendo
            // antes de alcanzar a presionar Enter — verificado en vivo
            // (foco perdido solo hacia document.body cuando el botón se
            // desmontaba debajo del usuario).
            onFocus={() => {
                pausedRef.current = true;
            }}
            onBlur={() => {
                pausedRef.current = false;
            }}
            aria-label={`Ver lote disponible ${lot.default_code}`}
        >
            <span className="venta-map-hint-label">Lote aquí</span>
            <PinIcon />
        </button>
    );
}
