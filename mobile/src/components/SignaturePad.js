import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, PanResponder } from 'react-native';

export default function SignaturePad({ onSignatureChange }) {
  const [lines, setLines] = useState([]);
  const currentLineRef = useRef([]);
  const containerRef = useRef(null);
  const offsetRef = useRef({ pageX: 0, pageY: 0 });

  const measureContainer = () => {
    if (containerRef.current) {
      containerRef.current.measure((x, y, width, height, pageX, pageY) => {
        if (pageX !== undefined && pageY !== undefined) {
          offsetRef.current = { pageX, pageY };
        }
      });
    }
  };

  const getPoint = (evt) => {
    const { pageX, pageY, locationX, locationY } = evt.nativeEvent;
    if (offsetRef.current.pageX > 0 && offsetRef.current.pageY > 0) {
      return {
        x: Math.round(Math.max(0, Math.min(300, pageX - offsetRef.current.pageX))),
        y: Math.round(Math.max(0, Math.min(150, pageY - offsetRef.current.pageY))),
      };
    }
    return {
      x: Math.round(Math.max(0, Math.min(300, locationX))),
      y: Math.round(Math.max(0, Math.min(150, locationY))),
    };
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        measureContainer();
        const pt = getPoint(evt);
        currentLineRef.current = [pt];
        setLines((prev) => [...prev, [pt]]);
      },
      onPanResponderMove: (evt) => {
        const pt = getPoint(evt);
        // Evitar puntos duplicados consecutivos
        const lastPt = currentLineRef.current[currentLineRef.current.length - 1];
        if (lastPt && Math.abs(lastPt.x - pt.x) < 1 && Math.abs(lastPt.y - pt.y) < 1) {
          return;
        }
        currentLineRef.current.push(pt);
        setLines((prev) => {
          const newLines = [...prev];
          newLines[newLines.length - 1] = [...currentLineRef.current];
          return newLines;
        });
      },
      onPanResponderRelease: () => {
        if (onSignatureChange && currentLineRef.current.length > 0) {
          const svgData = generateSvgString([...lines, currentLineRef.current]);
          onSignatureChange(svgData);
        }
      },
    })
  ).current;

  function generateSvgString(allLines) {
    if (!allLines || allLines.length === 0) return '';
    const paths = allLines
      .filter((l) => l.length > 0)
      .map((l) => {
        if (l.length === 1) {
          return `<circle cx="${l[0].x}" cy="${l[0].y}" r="2" fill="#0f172a" />`;
        }
        const d = l.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
        return `<path d="${d}" stroke="#0f172a" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" />`;
      })
      .join('');
    
    const rawSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="150" viewBox="0 0 300 150"><rect width="300" height="150" fill="#ffffff" rx="8"/>${paths}</svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(rawSvg)}`;
  }

  const handleClear = () => {
    setLines([]);
    currentLineRef.current = [];
    if (onSignatureChange) {
      onSignatureChange('');
    }
  };

  const hasSignature = lines.length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>✍️ Firma Digital del Entrevistado</Text>
        {hasSignature && (
          <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>🗑️ Limpiar Firma</Text>
          </TouchableOpacity>
        )}
      </View>

      <View
        ref={containerRef}
        onLayout={measureContainer}
        style={styles.canvasContainer}
        {...panResponder.panHandlers}
      >
        {/* Capa de trazos aislada de punteros (pointerEvents="none") para evitar saltos */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {lines.map((line, lineIndex) => (
            <React.Fragment key={lineIndex}>
              {line.map((pt, ptIndex) => {
                if (ptIndex === 0) return null;
                const prevPt = line[ptIndex - 1];
                const dx = pt.x - prevPt.x;
                const dy = pt.y - prevPt.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance === 0) return null;
                const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                const midX = (prevPt.x + pt.x) / 2;
                const midY = (prevPt.y + pt.y) / 2;

                return (
                  <View
                    key={ptIndex}
                    style={[
                      styles.strokeSegment,
                      {
                        left: midX - distance / 2,
                        top: midY - 1.5,
                        width: distance,
                        transform: [{ rotate: `${angle}deg` }],
                      },
                    ]}
                  />
                );
              })}
            </React.Fragment>
          ))}
        </View>

        {/* Línea guía de firma */}
        <View pointerEvents="none" style={styles.signatureBaseline} />

        {!hasSignature && (
          <View style={styles.placeholderOverlay} pointerEvents="none">
            <Text style={styles.placeholderText}>Firme aquí con su dedo</Text>
            <Text style={styles.subtext}>Firma autógrafa del solicitante o aval</Text>
          </View>
        )}
      </View>

      {hasSignature && (
        <Text style={styles.badgeSuccess}>✓ Firma capturada correctamente</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
  },
  clearBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  clearBtnText: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: 'bold',
  },
  canvasContainer: {
    height: 150,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#38bdf8',
    overflow: 'hidden',
    position: 'relative',
  },
  strokeSegment: {
    position: 'absolute',
    height: 3.5,
    backgroundColor: '#0f172a',
    borderRadius: 2,
  },
  signatureBaseline: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: '#cbd5e1',
    borderStyle: 'dashed',
  },
  placeholderOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '600',
  },
  subtext: {
    color: '#cbd5e1',
    fontSize: 11,
    marginTop: 4,
  },
  badgeSuccess: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 6,
    textAlign: 'right',
  },
});

