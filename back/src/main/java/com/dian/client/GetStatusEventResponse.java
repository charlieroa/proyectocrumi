
package com.dian.client;

import javax.xml.bind.JAXBElement;
import javax.xml.bind.annotation.XmlAccessType;
import javax.xml.bind.annotation.XmlAccessorType;
import javax.xml.bind.annotation.XmlElementRef;
import javax.xml.bind.annotation.XmlRootElement;
import javax.xml.bind.annotation.XmlType;


/**
 * <p>Java class for anonymous complex type.
 * 
 * <p>The following schema fragment specifies the expected content contained within this class.
 * 
 * <pre>
 * &lt;complexType>
 *   &lt;complexContent>
 *     &lt;restriction base="{http://www.w3.org/2001/XMLSchema}anyType">
 *       &lt;sequence>
 *         &lt;element name="GetStatusEventResult" type="{http://schemas.datacontract.org/2004/07/DianResponse}DianResponse" minOccurs="0"/>
 *       &lt;/sequence>
 *     &lt;/restriction>
 *   &lt;/complexContent>
 * &lt;/complexType>
 * </pre>
 * 
 * 
 */
@XmlAccessorType(XmlAccessType.FIELD)
@XmlType(name = "", propOrder = {
    "getStatusEventResult"
})
@XmlRootElement(name = "GetStatusEventResponse")
public class GetStatusEventResponse {

    @XmlElementRef(name = "GetStatusEventResult", namespace = "http://wcf.dian.colombia", type = JAXBElement.class, required = false)
    protected JAXBElement<DianResponse> getStatusEventResult;

    /**
     * Gets the value of the getStatusEventResult property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link DianResponse }{@code >}
     *     
     */
    public JAXBElement<DianResponse> getGetStatusEventResult() {
        return getStatusEventResult;
    }

    /**
     * Sets the value of the getStatusEventResult property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link DianResponse }{@code >}
     *     
     */
    public void setGetStatusEventResult(JAXBElement<DianResponse> value) {
        this.getStatusEventResult = value;
    }

}
