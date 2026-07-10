import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { LineChart, PieChart } from 'react-native-chart-kit';
import { getSymptomLogs } from '../../utils/storage';

const screenWidth = Dimensions.get('window').width;

export default function SymptomTrendsScreen() {
  const [logs, setLogs] = useState<any[]>([]);
  const [lineData, setLineData] = useState<{ labels: string[]; datasets: { data: number[]; color: (opacity?: number) => string; }[] }>({ labels: [], datasets: [] });
  const [pieData, setPieData] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const stored = await getSymptomLogs();
    if (stored) {
      setLogs(stored);
      prepareCharts(stored);
    }
  };

  const prepareCharts = (logs: any[]) => {
    // Line chart: last 7 entries
    const sorted = [...logs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const labels = sorted.map(log => new Date(log.date).toLocaleDateString());
    const severities = sorted.map(log => log.severity);
    setLineData({
      labels: labels.slice(-7),
      datasets: [{ data: severities.slice(-7), color: (opacity = 1) => `rgba(134, 65, 244, ${opacity})` }],
    });

    // Pie chart: symptom frequency
    const freq: Record<string, number> = {};
    logs.forEach(log => { freq[log.symptom] = (freq[log.symptom] || 0) + 1; });
    const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'];
    const pie = Object.keys(freq).map((key, index) => ({
      name: key,
      population: freq[key],
      color: colors[index % colors.length],
      legendFontColor: '#333',
      legendFontSize: 12,
    }));
    setPieData(pie as any);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Symptom Trends</Text>

      {lineData.labels.length > 0 && (
        <>
          <Text style={styles.subtitle}>Severity Over Time (Last 7 logs)</Text>
          <LineChart
            data={lineData}
            width={screenWidth - 32}
            height={220}
            chartConfig={{
              backgroundColor: '#fff',
              backgroundGradientFrom: '#fff',
              backgroundGradientTo: '#fff',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              style: { borderRadius: 16 },
            }}
            bezier
            style={styles.chart}
          />
        </>
      )}

      {pieData.length > 0 && (
        <>
          <Text style={styles.subtitle}>Symptom Frequency</Text>
          <PieChart
            data={pieData}
            width={screenWidth - 32}
            height={220}
            chartConfig={{
              color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            }}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  subtitle: { fontSize: 18, fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
  chart: { marginVertical: 8, borderRadius: 16 },
});