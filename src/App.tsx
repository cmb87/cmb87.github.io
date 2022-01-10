import React from 'react';
import {Navigate, Route, Routes} from "react-router-dom";
import './App.css';

import Header from "./components/Header";
import Home from './pages/Home';

function App() {


  return (
    <div className="flex flex-col h-screen w-full">

      <Header/>
      <br />
      <main className={'w-full flex flex-col pl-5 pr-5 items-center flex-grow'}>
      <Routes>
          <Route path="/" element={<Navigate replace to="/home"/>}/>
          <Route path="home" element={<Home/>}/>
          {/* <Route path="plate_analysis" element={<Plate/>}/>
          <Route path="plate_analysis_detailed/:vid" element={<PlateDetailed />}/> */}

      </Routes>
      </main>

      <footer className="h-10 border-t-2 border-grey">
          <div className={"flex justify-center pt-1"}>
              <p>
                  made with &#9829; by{" "}
                  <span
                      className={"cursor-pointer"}
                      title={"MARVEL is a growing network of people the work together for Making Applications Reality Very Efficient and Low-budget!"}
                  >
          MARVEL
        </span>
              </p>
          </div>
      </footer>
  
    </div>
  );
}

export default App;
