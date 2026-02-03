import React, { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { setAuthorization } from "../helpers/api_helper";
import { useDispatch } from "react-redux";

import { useProfile } from "../Components/Hooks/UserHooks";

import { logoutUser } from "../slices/auth/login/thunk";

const AuthProtected = (props : any) =>{
  const dispatch : any = useDispatch();
  const { userProfile, loading, token } = useProfile();
  
  useEffect(() => {
    if (userProfile && !loading && token) {
      setAuthorization(token);
    } else if (!userProfile && loading && !token) {
      dispatch(logoutUser());
    }
  }, [token, userProfile, loading, dispatch]);

  /*
    Navigate is un-auth access protected routes via url
    */

  if (!userProfile && loading && !token) {
    return (
      <Navigate to={{ pathname: "/login"}} />
    );
  }

  return <>{props.children}</>;
};


export default AuthProtected;



// import React, { useEffect } from "react";
// import { Navigate, Route } from "react-router-dom";
// import { setAuthorization } from "../helpers/api_helper";
// import { useDispatch } from "react-redux";

// import { useProfile } from "../Components/Hooks/UserHooks";

// import { logoutUser } from "../slices/thunks";

// const AuthProtected = (props : any) => {
//   const dispatch = useDispatch();
//   const { userProfile, loading, token } = useProfile();
//   useEffect(() => {
//     if (userProfile && !loading && token) {
//       setAuthorization(token);
//     } else if (!userProfile && loading && !token) {
//       dispatch(logoutUser());
//     }
//   }, [token, userProfile, loading, dispatch]);

//   /*
//     redirect is un-auth access protected routes via url
//     */

//   if (!userProfile && loading && !token) {
//     return (
//       <Navigate to={{ pathname: "/login", state: { from: props.location } }} />
//     );
//   }

//   return <>{props.children}</>;
// };

// const AccessRoute = ({ component: Component, ...rest }) => {
//   return (
//     <Route
//       {...rest}
//       render={props => {
//         return (<> <Component {...props} /> </>);
//       }}
//     />
//   );
// };

// export { AuthProtected, AccessRoute };