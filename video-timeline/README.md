# VideoEditor Template

A professional video timeline editor built with Angular 20.3, featuring drag-and-drop functionality, media management, and real-time preview capabilities.

## Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** (version 18.x or higher recommended)
- **npm** (comes with Node.js)
- **Angular CLI** (optional, as the project includes `ng` via npm scripts)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/andchir/video-timeline.git
cd video-timeline/video-timeline
```

2. Install dependencies:
```bash
npm install
```

## Development Mode

### Starting the Development Server

To run the application in development mode with hot reload:

```bash
npm start
```

Or using the Angular CLI directly:

```bash
ng serve
```

The development server will start at `http://localhost:4200/`. The application automatically reloads when you modify source files.

### Development Configuration

The development build includes:
- Source maps for easier debugging
- No optimization for faster builds
- No license extraction
- Detailed error messages

### Watch Mode

To continuously build the project while developing (without running a server):

```bash
npm run watch
```

This runs `ng build --watch --configuration development` and rebuilds on file changes.

## Running Tests

### Unit Tests

Execute unit tests using the [Karma](https://karma-runner.github.io) test runner:

```bash
npm test
```

Or with Angular CLI:

```bash
ng test
```

This will:
- Launch the Karma test runner
- Open a browser window
- Run all `*.spec.ts` test files
- Watch for changes and re-run tests automatically

### Test Configuration

Tests are configured with:
- **Test Framework**: Jasmine 5.9
- **Test Runner**: Karma 6.4
- **Browsers**: Chrome (via karma-chrome-launcher)
- **Coverage**: Available via karma-coverage

To run tests with coverage:

```bash
ng test --code-coverage
```

Coverage reports will be generated in the `coverage/` directory.

## Production Build

### Building for Production

To create an optimized production build:

```bash
npm run build
```

Or with Angular CLI:

```bash
ng build
```

Or explicitly specify production configuration:

```bash
ng build --configuration production
```

### Production Build Output

The production build will:
- Compile and bundle all source files
- Output to the `dist/` directory
- Apply optimizations (minification, tree-shaking)
- Add output hashing for cache busting
- Extract licenses

### Build Budgets

The production build enforces the following size budgets:
- **Initial bundle**: Warning at 500kB, error at 1MB
- **Component styles**: Warning at 4kB, error at 8kB

### Serving Production Build Locally

To test the production build locally, you can use a simple HTTP server:

```bash
npx http-server dist/video-timeline/browser -p 8080
```

Then open `http://localhost:8080` in your browser.

## Code Scaffolding

Generate new Angular components, services, and other schematics:

```bash
# Generate a component
ng generate component component-name

# Generate a service
ng generate service service-name

# Generate a directive
ng generate directive directive-name

# View all available schematics
ng generate --help
```

## Project Structure

```
video-timeline/
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   └── timeline/          # Main timeline component
│   │   ├── models/                # TypeScript interfaces and types
│   │   ├── app.ts                 # Root component
│   │   ├── app.config.ts          # Application configuration
│   │   └── app.routes.ts          # Routing configuration
│   ├── styles.css                 # Global styles
│   ├── main.ts                    # Application entry point
│   └── index.html                 # HTML entry point
├── public/                        # Static assets
├── angular.json                   # Angular CLI configuration
├── tsconfig.json                  # TypeScript configuration
└── package.json                   # Dependencies and scripts
```

## Available npm Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `start` | `ng serve` | Start development server |
| `build` | `ng build` | Build for production |
| `watch` | `ng build --watch --configuration development` | Build and watch for changes |
| `test` | `ng test` | Run unit tests |
| `ng` | `ng` | Access Angular CLI commands directly |

## Technologies Used

- **Angular 20.3** - Modern web application framework
- **TypeScript 5.9** - Typed superset of JavaScript
- **Tailwind CSS 4.1** - Utility-first CSS framework
- **Bootstrap Icons 1.13** - Icon library
- **RxJS 7.8** - Reactive programming library
- **Jasmine & Karma** - Testing framework and runner

## Code Quality

### Prettier Configuration

The project includes Prettier for code formatting:
- Print width: 100 characters
- Single quotes enabled
- Angular HTML parser for templates

Format code using your IDE's Prettier integration or:

```bash
npx prettier --write "src/**/*.{ts,html,css}"
```

### TypeScript Configuration

- Strict mode enabled for type safety
- Target: ES2022
- Module: ES2022

## Browser Support

The application is optimized for modern browsers supporting ES2022 features.

## Contributing

When contributing to this project:
1. Follow the existing code style and conventions
2. Write tests for new features
3. Ensure all tests pass before submitting
4. Update documentation as needed

## Additional Resources

- [Angular Documentation](https://angular.dev)
- [Angular CLI Command Reference](https://angular.dev/tools/cli)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## License

ISC

---

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 20.3.8.
