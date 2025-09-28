# IoT Telemetry Monitor

This repository contains a full-stack application for collecting, storing, and visualizing telemetry data from IoT devices, with a specific implementation for an iOS device using HealthKit.

The project is divided into three main parts:

1.  **`backend`**: A FastAPI server that provides a REST API for ingesting and retrieving telemetry data. It also includes a real-time streaming endpoint using Server-Sent Events (SSE).
2.  **`telemetry-dashboard`**: An Angular web application that visualizes the telemetry data in real-time. It includes a dashboard with charts and a table of the latest events.
3.  **`HKTelemetry`**: An iOS application that reads health and workout data from HealthKit, and sends it to the backend for storage and visualization.

## Architecture

The three components work together as follows:

1.  The **`HKTelemetry`** iOS app collects data from HealthKit (e.g., heart rate, step count, workout data).
2.  The iOS app sends this data to the **`backend`**'s `/api/telemetry` endpoint.
3.  The **`backend`** stores the data in a database (SQLite by default, but configurable to PostgreSQL).
4.  The **`telemetry-dashboard`** connects to the `backend`'s `/api/stream` endpoint to receive real-time updates.
5.  The dashboard displays the data in charts and a table, providing a live view of the telemetry data.

## Features

### Backend (FastAPI)

*   **FastAPI**: High-performance Python web framework.
*   **SQLAlchemy**: ORM for database interaction.
*   **Pydantic**: Data validation and settings management.
*   **REST API**: Endpoints for ingesting and querying telemetry data.
*   **Real-time Streaming**: Server-Sent Events (SSE) for pushing live data to clients.
*   **API Key Authentication**: Simple API key-based security for the ingestion endpoint.
*   **CORS**: Cross-Origin Resource Sharing configured to allow the frontend to connect.

### Frontend (Angular)

*   **Angular**: A powerful framework for building client-side applications.
*   **Angular Material**: UI component library for a clean and modern look.
*   **Chart.js**: For creating beautiful and interactive charts.
*   **Real-time Updates**: Live data visualization using Server-Sent Events.
*   **Dashboard**: A page with charts showing telemetry data over time.
*   **Events View**: A table displaying the latest telemetry events as they arrive.

### iOS App (HKTelemetry)

*   **SwiftUI**: Modern UI framework for iOS.
*   **HealthKit**: Integration with Apple's HealthKit to access health and fitness data.
*   **Data Upload**: Sends collected telemetry data to the backend API.

## Getting Started

### Prerequisites

*   Python 3.9+
*   Node.js and npm
*   Xcode and a physical iOS device (for HealthKit features)

### Backend Setup

1.  Navigate to the `backend` directory:
    ```bash
    cd backend
    ```
2.  Create a virtual environment:
    ```bash
    python -m venv venv
    source venv/bin/activate
    ```
3.  Install the dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4.  Create a `.env` file and set the `API_KEY`:
    ```
    API_KEY=your-secret-api-key
    ```
5.  Run the server:
    ```bash
    uvicorn app.main:app --reload
    ```
    The API will be available at `http://127.0.0.1:8000`.

### Frontend Setup

1.  Navigate to the `telemetry-dashboard` directory:
    ```bash
    cd telemetry-dashboard
    ```
2.  Install the dependencies:
    ```bash
    npm install
    ```
3.  Run the development server:
    ```bash
    npm start
    ```
    The dashboard will be available at `http://localhost:4200`.

### iOS App Setup

1.  Open the `HKTelemetry.xcodeproj` project in Xcode.
2.  Connect a physical iOS device.
3.  In `TelemetryUploader.swift`, change the `endpoint` URL to your backend's IP address if you are not running on localhost.
4.  Select your device and run the app.
5.  Grant the necessary HealthKit permissions when prompted.

## API Reference

### `POST /api/telemetry`

Ingests a new telemetry data point.

*   **Headers**: `X-API-Key: your-secret-api-key`
*   **Body**:
    ```json
    {
      "deviceId": "string",
      "metric": "string",
      "value": "float",
      "unit": "string",
      "timestamp": "datetime"
    }
    ```

### `GET /api/telemetry`

Retrieves the latest telemetry data points.

*   **Query Parameters**: `limit` (integer, default: 50)

### `GET /api/stream`

Streams new telemetry data in real-time using Server-Sent Events.

### `GET /healthz`

A health check endpoint to verify that the server is running and can connect to the database.

## Technologies Used

*   **Backend**: Python, FastAPI, SQLAlchemy, Uvicorn
*   **Frontend**: TypeScript, Angular, Angular Material, Chart.js, SCSS
*   **iOS**: Swift, SwiftUI, HealthKit
*   **Database**: SQLite (default), PostgreSQL (supported)

## Screenshots
![WhatsApp Image 2025-09-28 at 14 40 01](https://github.com/user-attachments/assets/4b6543d4-21f7-4bf5-a6b7-2d8aac38d4e4)

<img width="1765" height="942" alt="Screenshot 2025-09-28 at 2 40 26 PM" src="https://github.com/user-attachments/assets/afbcf9fc-c136-4feb-9026-a35be5ff0c28" />



