/* @refresh reload */
import React from "react";
import { createBrowserRouter } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Auth } from "./components/Auth";
import { CityCinemaSelection } from "./components/CityCinemaSelection";
import { MovieCatalog } from "./components/MovieCatalog";
import { MovieDetails } from "./components/MovieDetails";
import { SessionSchedule } from "./components/SessionSchedule";
import { SessionSelection } from "./components/SessionSelection";
import { SeatMap } from "./components/SeatMap";
import { BookingConfirmation } from "./components/BookingConfirm";
import { MyBookings } from "./components/MyBookings";
import { Profile } from "./components/Profile";
import { AdminPanel } from "./components/AdminPanel";
import { AppProvider } from "../context/AppContext";

function Root() {
  return (
    <AppProvider>
      <Layout />
    </AppProvider>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Auth },
      { path: "cities", Component: CityCinemaSelection },
      { path: "home", Component: MovieCatalog },
      { path: "schedule", Component: SessionSchedule },
      { path: "movie/:id", Component: MovieDetails },
      { path: "sessions/:movieId", Component: SessionSelection },
      { path: "seats/:sessionId", Component: SeatMap },
      { path: "checkout", Component: BookingConfirmation },
      { path: "bookings", Component: MyBookings },
      { path: "profile", Component: Profile },
      { path: "admin", Component: AdminPanel },
      { path: "*", Component: () => <div className="p-8 text-center text-white">404 Страница не найдена</div> },
    ],
  },
]);



