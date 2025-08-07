# DataCrafted

An AI-powered data analytics dashboard generator similar to graphed.com, built with Next.js 14, TypeScript, Tailwind CSS, and shadcn/ui.

## Features

- **File Upload**: Drag-and-drop support for CSV and XLSX files (up to 50MB)
- **AI Analysis**: Automatic data pattern recognition and insight generation
- **Smart Visualizations**: Automatic chart type selection based on data structure
- **Interactive Dashboard**: Beautiful, responsive charts using Recharts
- **Real-time Processing**: Instant dashboard generation with progress indicators

## Tech Stack

- **Frontend**: Next.js 14 with App Router, React, TypeScript
- **Styling**: Tailwind CSS with shadcn/ui components
- **Charts**: Recharts for data visualization
- **File Processing**: PapaParse (CSV) and XLSX (Excel files)
- **State Management**: Zustand
- **Icons**: Lucide React

## Project Structure

```
/app
  /dashboard/page.tsx      # Dashboard view with charts
  /page.tsx               # Landing page with upload
  /layout.tsx             # Root layout
  /globals.css            # Global styles

/components
  /ui/                    # shadcn/ui components
    button.tsx
    card.tsx
  /upload/
    file-upload.tsx       # Drag-and-drop upload component
  /dashboard/
    chart-wrapper.tsx     # Chart rendering component

/lib
  /services/
    ai-analysis.ts        # Data analysis logic
  /utils/
    file-parser.ts        # CSV/Excel parsing utilities
    cn.ts                 # Utility functions
  store.ts                # Zustand state management
```

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run the development server**:
   ```bash
   npm run dev
   ```

3. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

1. **Upload Data**: Drag and drop a CSV or Excel file (max 50MB)
2. **AI Analysis**: The system automatically analyzes your data structure
3. **View Dashboard**: Get instant insights with interactive charts
4. **Explore Data**: Review data quality metrics and column information

## Supported File Formats

- **CSV**: Comma-separated values files
- **XLSX**: Modern Excel files
- **XLS**: Legacy Excel files (converted automatically)

## Chart Types

The AI automatically selects appropriate visualizations:

- **Bar Charts**: For categorical data comparisons
- **Line Charts**: For trends and time series
- **Pie Charts**: For proportional data
- **Scatter Plots**: For correlation analysis
- **Area Charts**: For cumulative data

## Development

### Adding New Chart Types

1. Extend the `ChartWrapper` component in `/components/dashboard/chart-wrapper.tsx`
2. Update the analysis logic in `/lib/services/ai-analysis.ts`
3. Add the new chart type to the TypeScript interfaces

### Customizing Themes

The project uses Tailwind CSS with shadcn/ui. Customize colors in:
- `/app/globals.css` for CSS variables
- `/tailwind.config.ts` for theme configuration

## Building for Production

```bash
npm run build
npm start
```

## License

MIT License - see LICENSE file for details.