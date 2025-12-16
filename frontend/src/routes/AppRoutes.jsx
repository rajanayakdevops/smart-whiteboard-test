import { Routes, Route } from "react-router-dom";
import Home from "../pages/Home";
import CreateMeeting from "../pages/CreateMeeting";
import MeetingRoom from "../pages/MeetingRoom";

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/create" element={<CreateMeeting />} />
      <Route path="/room/:id" element={<MeetingRoom />} />
    </Routes>
  );
};

export default AppRoutes;
