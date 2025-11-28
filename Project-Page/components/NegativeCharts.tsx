'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, Cell, ReferenceLine, ReferenceArea } from 'recharts'

// 第一个图：Negative value occurrence rate (% of spots with any negative value across genes)
export function NegativeOccurrenceChart() {
  const data = [
    { method: 'STEM', rate: 32 },
    { method: 'STFlow', rate: 67 },
    { method: 'TRIPLEX', rate: 42 },
    { method: 'MERGE', rate: 39 },
    { method: 'BioFlow (Ours)', rate: 0.0 },
  ]

  return (
    <div className="w-full h-[420px] px-6 pt-6 pb-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 20, left: 60, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis 
            dataKey="method" 
            stroke="#4b5563"
            tick={{ fill: '#1f2937', fontSize: 12, fontWeight: 500 }}
            angle={-25}
            textAnchor="end"
            height={70}
            tickLine={false}
          />
          <YAxis 
            label={{ 
              value: 'Negative Value Occurrence Rate (%)', 
              angle: -90, 
              position: 'insideLeft', 
              offset: -10,
              style: { textAnchor: 'middle', fill: '#1f2937', fontSize: 13, fontWeight: 500 }
            }}
            stroke="#4b5563"
            tick={{ fill: '#4b5563', fontSize: 12 }}
            domain={[0, 70]}
            tickLine={false}
            width={55}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#ffffff', 
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
              padding: '8px 12px'
            }}
            formatter={(value: number) => [`${value.toFixed(1)}%`, '']}
            labelStyle={{ fontWeight: 600, marginBottom: '4px', color: '#1f2937' }}
            separator=": "
          />
          <Bar 
            dataKey="rate" 
            radius={[6, 6, 0, 0]}
            barSize={50}
          >
            {data.map((entry, index) => {
              let fillColor = '#475569' // 默认深灰蓝色
              if (entry.method === 'BioFlow (Ours)') {
                fillColor = '#059669' // 绿色突出优势
              } else if (entry.method === 'STFlow') {
                fillColor = '#64748b' // 灰蓝色
              } else if (entry.method === 'STEM') {
                fillColor = '#94a3b8' // 中等灰蓝色
              } else if (entry.method === 'TRIPLEX') {
                fillColor = '#cbd5e1' // 浅灰蓝色
              } else if (entry.method === 'MERGE') {
                fillColor = '#e2e8f0' // 很浅的灰蓝色
              }
              return (
                <Cell 
                  key={`cell-${index}`}
                  fill={fillColor}
                />
              )
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// 第二个图：Percentage of genes with negative values
export function NegativeGenesChart() {
  const data = [
    { method: 'STEM', percentage: 100 },
    { method: 'STFlow', percentage: 98 },
    { method: 'TRIPLEX', percentage: 70 },
    { method: 'MERGE', percentage: 42 },
    { method: 'BioFlow (Ours)', percentage: 0.0 },
  ]

  return (
    <div className="w-full h-[420px] px-6 pt-6 pb-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 20, left: 60, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis 
            dataKey="method" 
            stroke="#4b5563"
            tick={{ fill: '#1f2937', fontSize: 12, fontWeight: 500 }}
            angle={-25}
            textAnchor="end"
            height={70}
            tickLine={false}
          />
          <YAxis 
            label={{ 
              value: 'Percentage of Genes with Negative Values (%)', 
              angle: -90, 
              position: 'insideLeft', 
              offset: -10,
              style: { textAnchor: 'middle', fill: '#1f2937', fontSize: 13, fontWeight: 500 }
            }}
            stroke="#4b5563"
            tick={{ fill: '#4b5563', fontSize: 12 }}
            domain={[0, 100]}
            tickLine={false}
            width={55}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#ffffff', 
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
              padding: '8px 12px'
            }}
            formatter={(value: number) => [`${value.toFixed(1)}%`, '']}
            labelStyle={{ fontWeight: 600, marginBottom: '4px', color: '#1f2937' }}
            separator=": "
          />
          <Bar 
            dataKey="percentage" 
            radius={[6, 6, 0, 0]}
            barSize={50}
          >
            {data.map((entry, index) => {
              let fillColor = '#475569' // 默认深灰蓝色
              if (entry.method === 'BioFlow (Ours)') {
                fillColor = '#059669' // 绿色突出优势
              } else if (entry.method === 'STFlow') {
                fillColor = '#64748b' // 灰蓝色
              } else if (entry.method === 'STEM') {
                fillColor = '#94a3b8' // 中等灰蓝色
              } else if (entry.method === 'TRIPLEX') {
                fillColor = '#cbd5e1' // 浅灰蓝色
              } else if (entry.method === 'MERGE') {
                fillColor = '#e2e8f0' // 很浅的灰蓝色
              }
              return (
                <Cell 
                  key={`cell-${index}`}
                  fill={fillColor}
                />
              )
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// 第二个图：Probability paths
export function ProbabilityPathsChart() {
  // 模拟不同方法的概率路径数据
  // x轴：时间步/迭代步，y轴：表达值（可能为负）
  const steps = Array.from({ length: 50 }, (_, i) => i)
  
  // BioFlow: 始终在非负区域
  const bioflowPath = steps.map(step => ({
    step,
    value: Math.max(0, 2 + Math.sin(step / 5) * 0.5 + (step / 50) * 1.5),
  }))
  
  // STFlow: 会进入负值区域
  const stflowPath = steps.map(step => ({
    step,
    value: 2 + Math.sin(step / 4) * 1.2 - (step / 30) * 0.8,
  }))
  
  // STEM: 也会进入负值区域
  const stemPath = steps.map(step => ({
    step,
    value: 2.5 + Math.sin(step / 3.5) * 1.5 - (step / 25) * 1.2,
  }))
  
  // 合并数据用于图表
  const chartData = steps.map((step, i) => ({
    step,
    BioFlow: bioflowPath[i].value,
    STFlow: stflowPath[i].value,
    STEM: stemPath[i].value,
  }))

  return (
    <div className="w-full h-[400px] p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="step" 
            label={{ value: 'Time Step', position: 'insideBottom', offset: -5, fill: '#374151' }}
            stroke="#6b7280"
            tick={{ fill: '#374151', fontSize: 12 }}
          />
          <YAxis 
            label={{ value: 'Expression Value', angle: -90, position: 'insideLeft', fill: '#374151' }}
            stroke="#6b7280"
            tick={{ fill: '#374151', fontSize: 12 }}
            domain={[-2, 5]}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#fff', 
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}
          />
          {/* 负值区域背景 - 放在最前面作为背景 */}
          <ReferenceArea y1={-2} y2={0} fill="#fee2e2" fillOpacity={0.2} />
          {/* 零值线 */}
          <ReferenceLine 
            y={0} 
            stroke="#dc2626" 
            strokeWidth={2} 
            strokeDasharray="5 5"
            label={{ value: "Zero", position: "right", fill: "#dc2626" }}
          />
          {/* 各方法的路径 */}
          <Line 
            type="monotone" 
            dataKey="BioFlow" 
            stroke="#10b981" 
            strokeWidth={3}
            dot={false}
            name="BioFlow"
          />
          <Line 
            type="monotone" 
            dataKey="STFlow" 
            stroke="#ef4444" 
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            name="STFlow"
          />
          <Line 
            type="monotone" 
            dataKey="STEM" 
            stroke="#f59e0b" 
            strokeWidth={2}
            strokeDasharray="3 3"
            dot={false}
            name="STEM"
          />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

