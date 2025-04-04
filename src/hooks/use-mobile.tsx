
import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    // Function to detect if device is mobile based on user agent
    const checkIfMobile = () => {
      // Check screen width
      const isSmallScreen = window.innerWidth < MOBILE_BREAKPOINT
      
      // Check user agent for mobile devices
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
      const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i
      const isMobileDevice = mobileRegex.test(userAgent.toLowerCase())
      
      // Device is considered mobile if either condition is true
      return isSmallScreen || isMobileDevice
    }

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    
    const onChange = () => {
      setIsMobile(checkIfMobile())
    }
    
    mql.addEventListener("change", onChange)
    setIsMobile(checkIfMobile())
    
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
