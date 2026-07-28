import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, PanResponder } from 'react-native';

export default function SignaturePad({ onSignatureChange }) {
  const [lines, setLines] = useState([]);
  const currentLineRef = useRef([]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const pt = { x: Math.round(locationX), y: Math.round(locationY) };
        currentLineRef.current = [pt];
        setLines((prev) => [...prev, [pt]]);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const pt = { x: Math.round(locationX), y: Math.round(locationY) };
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
    const paths = allLines
      .filter((l) => l.length > 0)
      .map((l) => {
        const d = l.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
        return `<path d="${d}" stroke="#38bdf8" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" />`;
      })
      .join('');
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="150" viewBox="0 0 300 150">${paths}</svg>`;
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
        <Text style={styles.title}>✍️ Firma Digital del Atendido</Text>
        {hasSignature && (
          <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>🗑️ Limpiar Firma</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.canvasContainer} {...panResponder.panHandlers}>
        {lines.map((line, lineIndex) => (
          <React.Fragment key={lineIndex}>
            {line.map((pt, ptIndex) => {
              if (ptIndex === 0) return null;
              const prevPt = line[ptIndex - 1];
              const dx = pt.x - prevPt.x;
              const dy = pt.y - prevPt.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);

              return (
                <View
                  key={ptIndex}
                  style={[
                    styles.strokeSegment,
                    {
                      left: prevPt.x,
                      top: prevPt.y,
                      width: distance,
                      transform: [{ rotate: `${angle}deg` }],
                    },
                  ]}
                />
              );
            })}
          </React.Fragment>
        ))}

        {!hasSignature && (
          <View style={styles.placeholderOverlay} pointerEvents="none">
            <Text style={styles.placeholderText}>Firme aquí con su dedo</Text>
          </View>
        )}
      </View>
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
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
    position: 'relative',
  },
  strokeSegment: {
    position: 'absolute',
    height: 3,
    backgroundColor: '#38bdf8',
    borderRadius: 1.5,
    transformOrigin: '0% 50%',
  },
  placeholderOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#475569',
    fontSize: 14,
    fontStyle: 'italic',
  },
});
