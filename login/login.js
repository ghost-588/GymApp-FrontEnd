document.getElementById("loginForm").addEventListener("submit", async function(event) {
    event.preventDefault(); // Prevent page refresh
  
    const email = document.getElementById("Email").value;
    const password = document.getElementById("Password").value;
  
    const formData = new URLSearchParams();
    formData.append("username", email);
    formData.append("password", password);
  
    try {
      const response = await fetch("https://gym-app-lime-nine.vercel.app/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: formData.toString()
      });
  
      const data = await response.json();
  
      if (!response.ok) {
        throw new Error(data.detail || "Login failed");
      }
  
      localStorage.setItem("access_token", data.refresh_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      const token = localStorage.getItem("access_token");
      const adminResponse = await fetch ("https://gym-app-lime-nine.vercel.app/users/",{
        
        method : "GET",
        headers:{
                 "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
        }
      });
      adminResponse.json()
      if(adminResponse.ok)
      window.location.href = "/GymApp-FrontEnd/admin/admin.html";
    else window.location.href = "/GymApp-FrontEnd/user_exercise/user_exercise.html"
    } catch (error) {
      console.error("Error:", error.message);
      alert(error.message); // Optional: show error to user
    }
  });

  

