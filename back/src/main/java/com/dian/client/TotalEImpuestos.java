
package com.dian.client;

import javax.xml.bind.annotation.XmlAccessType;
import javax.xml.bind.annotation.XmlAccessorType;
import javax.xml.bind.annotation.XmlElement;
import javax.xml.bind.annotation.XmlType;


/**
 * <p>Java class for TotalEImpuestos complex type.
 * 
 * <p>The following schema fragment specifies the expected content contained within this class.
 * 
 * <pre>
 * &lt;complexType name="TotalEImpuestos">
 *   &lt;complexContent>
 *     &lt;restriction base="{http://www.w3.org/2001/XMLSchema}anyType">
 *       &lt;sequence>
 *         &lt;element name="Iva" type="{http://www.w3.org/2001/XMLSchema}double" minOccurs="0"/>
 *         &lt;element name="Total" type="{http://www.w3.org/2001/XMLSchema}double" minOccurs="0"/>
 *       &lt;/sequence>
 *     &lt;/restriction>
 *   &lt;/complexContent>
 * &lt;/complexType>
 * </pre>
 * 
 * 
 */
@XmlAccessorType(XmlAccessType.FIELD)
@XmlType(name = "TotalEImpuestos", namespace = "http://schemas.datacontract.org/2004/07/TotalEImpuestos", propOrder = {
    "iva",
    "total"
})
public class TotalEImpuestos {

    @XmlElement(name = "Iva")
    protected Double iva;
    @XmlElement(name = "Total")
    protected Double total;

    /**
     * Gets the value of the iva property.
     * 
     * @return
     *     possible object is
     *     {@link Double }
     *     
     */
    public Double getIva() {
        return iva;
    }

    /**
     * Sets the value of the iva property.
     * 
     * @param value
     *     allowed object is
     *     {@link Double }
     *     
     */
    public void setIva(Double value) {
        this.iva = value;
    }

    /**
     * Gets the value of the total property.
     * 
     * @return
     *     possible object is
     *     {@link Double }
     *     
     */
    public Double getTotal() {
        return total;
    }

    /**
     * Sets the value of the total property.
     * 
     * @param value
     *     allowed object is
     *     {@link Double }
     *     
     */
    public void setTotal(Double value) {
        this.total = value;
    }

}
