import React from "react";
import {Link, NavLink, useNavigate} from "react-router-dom";
import {createBrowserHistory} from "history";
import environment from "../environment.json";

import logo from "../assets/imgs/logo.png";


const Header = () => {
    const history = createBrowserHistory();
    const navigate = useNavigate();
    return (
        <div className="h-20 w-full flex justify-between bg-transparent text-gray-800 border-b-4 border-black">
            <div className="w-1/2 flex justify-start pl-10 items-center">
                <h1
                    onClick={() => navigate('/')}
                    className="text-3xl font-bold tracking-widest cursor-pointer z-10"
                >
                    HausSanierung II
                </h1>

                <img src={logo} width={50} height={50}/>

            </div>
            <div className="flex justify-around pl-8 items-center pr-10">
                {environment["routes"].map(({path, label}, idx) => {
                    return (
                        <NavLink
                            key={idx}
                            to={path}
                            className={({isActive}) => "nav-link" + (isActive ? " activated" : "")}
                        >
                            {label}
                        </NavLink>
                    );
                })}
            </div>
        </div>
    );
};

export default Header;
