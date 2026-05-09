export default function App() {
  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1">
        <TopBar />
        <MainContent />
      </div>
    </div>
  );
}
